import { generateKeyPairSync } from "node:crypto";
import { createLocalJWKSet, exportJWK, importSPKI, jwtVerify, SignJWT, type JWK } from "jose";
import supertest from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { APPLE_ISSUER, nonceFor } from "../../server/services/appleAuth";
import { client, closeDb, hasDb, makeApp, resetDb } from "./helpers";

const d = hasDb ? describe : describe.skip;
const CLIENT_ID = "test.linkfusion.web";

// Our team key (signs the client secret) and a stand-in for Apple's ID-token key.
const teamKey = generateKeyPairSync("ec", { namedCurve: "P-256" });
const appleKey = generateKeyPairSync("rsa", { modulusLength: 2048 });

const env = {
  APPLE_CLIENT_ID: CLIENT_ID,
  APPLE_TEAM_ID: "TEAM123456",
  APPLE_KEY_ID: "KEY1234567",
  APPLE_PRIVATE_KEY: teamKey.privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n"),
};

type Claims = { sub?: string; email?: string; email_verified?: boolean | string; nonce?: string; aud?: string };

async function idToken(claims: Claims) {
  return new SignJWT({ email_verified: true, ...claims })
    .setProtectedHeader({ alg: "RS256", kid: "apple-test" })
    .setIssuer(APPLE_ISSUER)
    .setAudience(claims.aud ?? CLIENT_ID)
    .setSubject(claims.sub ?? "001234.apple-user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(appleKey.privateKey);
}

d("Sign in with Apple", () => {
  let tokenRequests: URLSearchParams[];
  let nextToken: () => Promise<string>;
  let app: Awaited<ReturnType<typeof makeApp>>;

  beforeEach(async () => {
    await resetDb();
    tokenRequests = [];
    const jwk: JWK = { ...(await exportJWK(appleKey.publicKey)), kid: "apple-test", alg: "RS256" };
    app = await makeApp({
      env,
      appleDeps: {
        jwks: createLocalJWKSet({ keys: [jwk] }),
        fetchImpl: (async (_url: string | URL | Request, init?: RequestInit) => {
          tokenRequests.push(new URLSearchParams(String(init?.body)));
          return new Response(JSON.stringify({ id_token: await nextToken() }), { status: 200 });
        }) as typeof fetch,
      },
    });
  });
  afterAll(closeDb);

  /** Start the flow, then post back the way Apple does: cross-site, form-encoded. */
  async function signIn(opts: { claims?: (state: string) => Claims; tamperState?: boolean; user?: object } = {}) {
    const start = await supertest(app).get("/api/auth/apple");
    const cookie = start.headers["set-cookie"]![0]!.split(";")[0]!;
    const state = new URL(start.headers.location!).searchParams.get("state")!;
    nextToken = () =>
      idToken(opts.claims?.(state) ?? { email: "ada@privaterelay.appleid.com", nonce: nonceFor(state) });

    const browser = supertest.agent(app);
    const res = await browser
      .post("/api/auth/apple/callback")
      .set("Origin", APPLE_ISSUER)
      .set("Cookie", cookie)
      .type("form")
      .send({
        state: opts.tamperState ? `${state}x` : state,
        code: "auth-code-123",
        ...(opts.user ? { user: JSON.stringify(opts.user) } : {}),
      });
    return { start, res, browser, state };
  }

  it("is advertised only when configured", async () => {
    expect((await client(app).get("/api/auth/providers")).body).toEqual({
      local: true,
      google: false,
      github: false,
      apple: true,
    });
  });

  it("redirects to Apple with form_post, a state bound to an HttpOnly cookie, and a derived nonce", async () => {
    const { start, state } = await signIn();
    const url = new URL(start.headers.location!);
    expect(url.origin + url.pathname).toBe(`${APPLE_ISSUER}/auth/authorize`);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CLIENT_ID,
      redirect_uri: "http://lf.test/api/auth/apple/callback",
      response_mode: "form_post",
      scope: "name email",
      nonce: nonceFor(state),
    });
    expect(state.length).toBeGreaterThanOrEqual(43);
    const cookie = start.headers["set-cookie"]![0]!;
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=None/);
    expect(cookie).toMatch(/Path=\/api\/auth\/apple/);
  });

  it("signs in with a verified ID token and a client secret signed by the team key", async () => {
    const { res, browser } = await signIn({ user: { name: { firstName: "Ada", lastName: "Lovelace" } } });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/");

    const me = await browser.get("/api/auth/user");
    expect(me.body).toMatchObject({
      email: "ada@privaterelay.appleid.com",
      firstName: "Ada",
      lastName: "Lovelace",
      providers: ["apple"],
      hasPassword: false,
    });

    const sent = tokenRequests[0]!;
    expect(sent.get("code")).toBe("auth-code-123");
    const publicKey = await importSPKI(teamKey.publicKey.export({ type: "spki", format: "pem" }).toString(), "ES256");
    const { payload, protectedHeader } = await jwtVerify(sent.get("client_secret")!, publicKey, {
      issuer: "TEAM123456",
      audience: APPLE_ISSUER,
      subject: CLIENT_ID,
    });
    expect(protectedHeader.kid).toBe("KEY1234567");
    expect(payload.exp! - payload.iat!).toBeLessThanOrEqual(300);
  });

  it("rejects a state that doesn't match the browser's cookie without calling Apple", async () => {
    const { res } = await signIn({ tamperState: true });
    expect(res.headers.location).toBe("/signin?error=oauth");
    expect(tokenRequests).toHaveLength(0);
  });

  it("rejects ID tokens with the wrong nonce or audience", async () => {
    const forged: Array<(state: string) => Claims> = [
      () => ({ email: "x@example.com", nonce: nonceFor("someone-elses-state") }),
      (state) => ({ email: "x@example.com", nonce: nonceFor(state), aud: "another.app" }),
    ];
    for (const claims of forged) {
      const { res, browser } = await signIn({ claims });
      expect(res.headers.location).toBe("/signin?error=oauth");
      expect((await browser.get("/api/auth/user")).status).toBe(401);
    }
  });

  it("won't create or link an account from an unverified email", async () => {
    const { res } = await signIn({
      claims: (state) => ({ email: "eve@example.com", email_verified: "false", nonce: nonceFor(state) }),
    });
    expect(res.headers.location).toBe("/signin?error=unverified");
  });
});
