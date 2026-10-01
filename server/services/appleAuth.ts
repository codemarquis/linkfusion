/**
 * Sign in with Apple (OpenID Connect, authorization-code flow).
 *
 * Apple posts the result back to us cross-site (response_mode=form_post), so the
 * lax session cookie is not sent with it. Instead the browser is bound to the flow
 * with a short-lived state cookie, and the ID token's nonce is derived from that
 * state. The ID token is fetched server-to-server and its signature, issuer,
 * audience, expiry and nonce are all verified before anything is trusted.
 */
import { createHash } from "node:crypto";
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT, type JWTVerifyGetKey } from "jose";
import { z } from "zod";
import type { AppleConfig } from "../config";
import type { OAuthProfile } from "./authService";

export const APPLE_ISSUER = "https://appleid.apple.com";

export type AppleDeps = { fetchImpl?: typeof fetch; jwks?: JWTVerifyGetKey };

const tokenResponse = z.object({ id_token: z.string().min(1) });
const claimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().optional(),
  email_verified: z.union([z.boolean(), z.enum(["true", "false"])]).optional(),
  nonce: z.string().optional(),
});
// Apple only sends the user's name once, on the first authorization, as JSON in the form body.
const userField = z.object({
  name: z.object({ firstName: z.string().max(100).optional(), lastName: z.string().max(100).optional() }).optional(),
});

export const nonceFor = (state: string) => createHash("sha256").update(state).digest("hex");

export function createAppleAuth(config: AppleConfig, redirectUri: string, deps: AppleDeps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const jwks = deps.jwks ?? createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));
  let signingKey: ReturnType<typeof importPKCS8> | undefined;

  /** Apple's "client secret" is a short-lived JWT signed with the team's private key. */
  async function clientSecret(): Promise<string> {
    signingKey ??= importPKCS8(config.privateKey, "ES256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "ES256", kid: config.keyId })
      .setIssuer(config.teamId)
      .setSubject(config.clientId)
      .setAudience(APPLE_ISSUER)
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(await signingKey);
  }

  return {
    authorizeUrl(state: string): string {
      const url = new URL(`${APPLE_ISSUER}/auth/authorize`);
      url.search = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        response_mode: "form_post",
        scope: "name email",
        state,
        nonce: nonceFor(state),
      }).toString();
      return url.toString();
    },

    async profileFromCode(code: string, state: string, rawUser?: string): Promise<OAuthProfile> {
      const res = await fetchImpl(`${APPLE_ISSUER}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: await clientSecret(),
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Apple token endpoint returned ${res.status}`);
      const { id_token } = tokenResponse.parse(await res.json());

      const { payload } = await jwtVerify(id_token, jwks, {
        issuer: APPLE_ISSUER,
        audience: config.clientId,
        algorithms: ["RS256"],
      });
      const claims = claimsSchema.parse(payload);
      if (claims.nonce !== nonceFor(state)) throw new Error("Apple ID token nonce mismatch");

      let name: z.infer<typeof userField>["name"];
      try {
        name = rawUser ? userField.parse(JSON.parse(rawUser)).name : undefined;
      } catch {
        name = undefined; // cosmetic only; never fail sign-in over it
      }

      return {
        provider: "apple",
        providerUserId: claims.sub,
        email: claims.email ?? null,
        emailVerified: claims.email_verified === true || claims.email_verified === "true",
        firstName: name?.firstName ?? null,
        lastName: name?.lastName ?? null,
        avatarUrl: null,
      };
    },
  };
}

export type AppleAuth = ReturnType<typeof createAppleAuth>;
