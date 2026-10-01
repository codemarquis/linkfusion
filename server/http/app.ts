/**
 * Composition root: config → database → repositories → services → HTTP.
 * Returns the Express app without listening, so tests can drive it directly.
 */
import connectPg from "connect-pg-simple";
import express, { type Express } from "express";
import session from "express-session";
import passport from "passport";
import type pg from "pg";
import type { Config } from "../config";
import type { Database } from "../db";
import { createClickRepository } from "../repositories/clickRepository";
import { createLinkRepository } from "../repositories/linkRepository";
import { createQrRepository } from "../repositories/qrRepository";
import { createUserRepository } from "../repositories/userRepository";
import { createAnalyticsService } from "../services/analyticsService";
import { createAppleAuth, type AppleDeps } from "../services/appleAuth";
import { createAuthService } from "../services/authService";
import { createLinkService } from "../services/linkService";
import { createRedirectService } from "../services/redirectService";
import { loadUser, requireAdmin, requireUser } from "./middleware/auth";
import { errorHandler, notFoundApi } from "./middleware/errors";
import {
  DEFAULT_RATE_LIMITS,
  rateLimiters,
  requestLog,
  requireSameOrigin,
  securityHeaders,
  type RateLimits,
} from "./middleware/security";
import { adminRoutes } from "./routes/admin";
import { analyticsRoutes } from "./routes/analytics";
import { authRoutes } from "./routes/auth";
import { linkRoutes } from "./routes/links";
import { profileRoutes } from "./routes/profile";
import { redirectRoutes } from "./routes/redirect";

export type AppDeps = {
  config: Config;
  db: Database;
  pool: pg.Pool;
  rateLimits?: Partial<RateLimits>;
  quiet?: boolean;
  /** Test seam for Sign in with Apple's token endpoint and signing keys. */
  appleDeps?: AppleDeps;
};

export function createApp(deps: AppDeps): Express {
  const { config, db, pool } = deps;
  const limits = rateLimiters({ ...DEFAULT_RATE_LIMITS, ...deps.rateLimits });

  const users = createUserRepository(db);
  const linksRepo = createLinkRepository(db);
  const clicks = createClickRepository(db);
  const qr = createQrRepository(db);

  const auth = createAuthService(users);
  const links = createLinkService({ links: linksRepo, qr, publicBaseUrl: config.publicBaseUrl });
  const redirects = createRedirectService({ links: linksRepo, clicks });
  const analytics = createAnalyticsService({ clicks, links: linksRepo });
  const apple = config.apple
    ? createAppleAuth(config.apple, `${config.publicBaseUrl}/api/auth/apple/callback`, deps.appleDeps)
    : undefined;

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy); // only trust X-Forwarded-* from known proxy hops

  app.use(securityHeaders(config));
  if (!deps.quiet) app.use(requestLog());
  app.use(express.json({ limit: "16kb" }));

  const PgStore = connectPg(session);
  app.use(
    session({
      name: config.isProduction ? "__Host-lf.sid" : "lf.sid",
      secret: config.sessionSecret,
      store: new PgStore({ pool, tableName: "sessions", createTableIfMissing: false, pruneSessionInterval: 60 * 15 }),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      proxy: config.trustProxy > 0,
      cookie: {
        httpOnly: true,
        secure: config.isProduction,
        sameSite: "lax", // lax so the OAuth provider's redirect back still carries the session
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: "/",
      },
    }),
  );
  app.use(passport.initialize());
  app.use(requireSameOrigin(config));
  app.use(loadUser(users));

  // ---- API ---------------------------------------------------------------------
  const api = express.Router();
  api.get("/health", (_req, res) => res.json({ status: "ok" }));
  api.get("/health/ready", async (_req, res) => {
    try {
      await pool.query("select 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
  });
  api.use(limits.api);
  api.use("/auth", authRoutes({ config, auth, apple, authLimiter: limits.auth }));
  api.use("/profile", requireUser, profileRoutes({ config, users, auth, links }));
  api.use("/links", requireUser, linkRoutes({ links, qr, analytics }));
  api.use("/analytics", requireUser, analyticsRoutes({ analytics }));
  api.use("/admin", requireAdmin, adminRoutes({ users, linksRepo, clicks, links, auth, analytics }));
  api.use(notFoundApi);
  app.use("/api", api);

  // ---- public short links (after /api, before the SPA) --------------------------
  app.use(
    redirectRoutes({
      redirects,
      ownHost: new URL(config.publicBaseUrl).hostname,
      redirectLimiter: limits.redirect,
      unlockLimiter: limits.unlock,
    }),
  );

  return app;
}

export function attachErrorHandler(app: Express): void {
  app.use(errorHandler);
}
