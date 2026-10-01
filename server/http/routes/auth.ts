import { randomBytes, timingSafeEqual } from "node:crypto";
import express, { Router, type Request, type Response, type NextFunction } from "express";
import passport from "passport";
import { Strategy as GitHubStrategy, type StrategyOptions as GitHubOptions } from "passport-github2";
import { Strategy as GoogleStrategy, type Profile as GoogleProfile } from "passport-google-oauth20";
import { loginSchema, registerSchema, type AuthProviders } from "@shared/api";
import type { Config } from "../../config";
import { unauthorized } from "../../errors";
import type { AppleAuth } from "../../services/appleAuth";
import type { AuthService, OAuthProfile } from "../../services/authService";
import { establishSession } from "../middleware/auth";

type Limiter = (req: Request, res: Response, next: NextFunction) => void;

const APPLE_STATE_COOKIE = "__Secure-lf.apple";
const APPLE_COOKIE_PATH = "/api/auth/apple";

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

const sameSecret = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** GitHub only reports verification via /user/emails, so ask it directly. */
async function githubPrimaryEmail(accessToken: string): Promise<{ email: string | null; verified: boolean }> {
  const res = await fetch("https://api.github.com/user/emails", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "LinkFusion" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { email: null, verified: false };
  const emails = (await res.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
  const primary = emails.find((e) => e.primary) ?? emails.find((e) => e.verified);
  return { email: primary?.email ?? null, verified: Boolean(primary?.verified) };
}

export function authRoutes(deps: { config: Config; auth: AuthService; apple?: AppleAuth; authLimiter: Limiter }) {
  const { config, auth } = deps;
  const router = Router();

  router.get("/providers", (_req, res) => {
    const providers: AuthProviders = {
      local: true,
      google: Boolean(config.google),
      github: Boolean(config.github),
      apple: Boolean(deps.apple),
    };
    res.json(providers);
  });

  router.post("/register", deps.authLimiter, async (req, res, next) => {
    try {
      const user = await auth.register(registerSchema.parse(req.body));
      await establishSession(req, user.id);
      res.status(201).json(await auth.toPublic(user));
    } catch (err) {
      next(err);
    }
  });

  router.post("/login", deps.authLimiter, async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const user = await auth.authenticate(email, password);
      await establishSession(req, user.id);
      res.json(await auth.toPublic(user));
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie(config.isProduction ? "__Host-lf.sid" : "lf.sid", { path: "/" });
      res.status(204).end();
    });
  });

  router.get("/user", async (req, res, next) => {
    try {
      if (!req.currentUser) throw unauthorized();
      res.json(await auth.toPublic(req.currentUser));
    } catch (err) {
      next(err);
    }
  });

  // ---- OAuth (only registered when configured) -------------------------------
  const finishOAuth = (provider: "google" | "github") => (req: Request, res: Response, next: NextFunction) =>
    passport.authenticate(provider, { session: false }, async (err: unknown, profile: OAuthProfile | false) => {
      if (err || !profile) {
        const code = (err as { code?: string })?.code === "EMAIL_NOT_VERIFIED" ? "unverified" : "oauth";
        return res.redirect(`/signin?error=${code}`);
      }
      try {
        const user = await auth.signInWithOAuth(profile);
        await establishSession(req, user.id);
        res.redirect("/");
      } catch (e) {
        const code = (e as { code?: string }).code === "EMAIL_NOT_VERIFIED" ? "unverified" : "oauth";
        if (code === "oauth") console.error(`[oauth] ${provider} sign-in failed:`, e);
        res.redirect(`/signin?error=${code}`);
      }
    })(req, res, next);

  if (config.google) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.google.clientId,
          clientSecret: config.google.clientSecret,
          callbackURL: `${config.publicBaseUrl}/api/auth/google/callback`,
          state: true, // session-backed anti-CSRF state parameter
        },
        (_at, _rt, p: GoogleProfile, done) => {
          const email = p.emails?.[0];
          const profile: OAuthProfile = {
            provider: "google",
            providerUserId: p.id,
            email: email?.value ?? null,
            emailVerified: email?.verified === true || (p._json as { email_verified?: boolean }).email_verified === true,
            firstName: p.name?.givenName ?? null,
            lastName: p.name?.familyName ?? null,
            avatarUrl: p.photos?.[0]?.value ?? null,
          };
          done(null, profile as unknown as Express.User);
        },
      ),
    );
    router.get("/google", deps.authLimiter, passport.authenticate("google", { scope: ["openid", "email", "profile"], session: false }));
    router.get("/google/callback", finishOAuth("google"));
  }

  if (config.github) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: config.github.clientId,
          clientSecret: config.github.clientSecret,
          callbackURL: `${config.publicBaseUrl}/api/auth/github/callback`,
          scope: ["read:user", "user:email"],
          // passport-oauth2 accepts state: true (session-backed anti-CSRF state); these typings only allow a string.
          state: true as unknown as string,
        } satisfies GitHubOptions,
        async (
          accessToken: string,
          _rt: string,
          p: { id: string; displayName?: string; photos?: Array<{ value: string }> },
          done: (e: unknown, u?: OAuthProfile) => void,
        ) => {
          try {
            const { email, verified } = await githubPrimaryEmail(accessToken);
            const [firstName, ...rest] = (p.displayName ?? "").split(" ");
            done(null, {
              provider: "github",
              providerUserId: String(p.id),
              email,
              emailVerified: verified,
              firstName: firstName || null,
              lastName: rest.join(" ") || null,
              avatarUrl: p.photos?.[0]?.value ?? null,
            });
          } catch (err) {
            done(err);
          }
        },
      ),
    );
    router.get("/github", deps.authLimiter, passport.authenticate("github", { session: false }));
    router.get("/github/callback", finishOAuth("github"));
  }

  const apple = deps.apple;
  if (apple) {
    router.get("/apple", deps.authLimiter, (_req, res) => {
      const state = randomBytes(32).toString("base64url");
      // SameSite=None so the cookie comes back on Apple's cross-site form POST;
      // HttpOnly, Secure, scoped to this path and gone after ten minutes.
      res.cookie(APPLE_STATE_COOKIE, state, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: APPLE_COOKIE_PATH,
        maxAge: 10 * 60 * 1000,
      });
      res.redirect(apple.authorizeUrl(state));
    });

    router.post(
      "/apple/callback",
      deps.authLimiter,
      express.urlencoded({ extended: false, limit: "16kb" }),
      async (req, res) => {
        const expected = readCookie(req, APPLE_STATE_COOKIE);
        res.clearCookie(APPLE_STATE_COOKIE, { path: APPLE_COOKIE_PATH, secure: true, sameSite: "none" });
        const body = req.body as Record<string, unknown>;
        const { state, code, user } = body;
        if (
          typeof state !== "string" ||
          typeof code !== "string" ||
          !expected ||
          !sameSecret(state, expected)
        ) {
          return res.redirect(303, "/signin?error=oauth");
        }
        try {
          const profile = await apple.profileFromCode(code, state, typeof user === "string" ? user : undefined);
          const signedIn = await auth.signInWithOAuth(profile);
          await establishSession(req, signedIn.id);
          res.redirect(303, "/");
        } catch (e) {
          const unverified = (e as { code?: string }).code === "EMAIL_NOT_VERIFIED";
          if (!unverified) console.error("[oauth] apple sign-in failed:", e);
          res.redirect(303, `/signin?error=${unverified ? "unverified" : "oauth"}`);
        }
      },
    );
  }

  return router;
}
