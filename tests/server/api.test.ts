import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { seedDemo } from "../../server/services/demoData";
import { ORIGIN, client, closeDb, database, hasDb, makeApp, resetDb, signUp } from "./helpers";

const d = hasDb ? describe : describe.skip;

async function makeAdmin(email: string) {
  const { db } = await database();
  await db.execute(sql`update users set is_admin = true where email = ${email}`);
}

d("API (integration)", () => {
  let app: Awaited<ReturnType<typeof makeApp>>;
  beforeEach(async () => {
    await resetDb();
    app = await makeApp();
  });
  afterAll(closeDb);

  describe("auth", () => {
    it("registers, signs in, returns the user without secrets, and signs out", async () => {
      const c = client(app);
      const user = await signUp(c);
      expect(user).toMatchObject({ email: "alice@example.com", isAdmin: false, hasPassword: true });
      expect(JSON.stringify(user)).not.toMatch(/password_?hash|scrypt/i);

      expect((await c.get("/api/auth/user")).status).toBe(200);
      expect((await c.post("/api/auth/logout")).status).toBe(204);
      expect((await c.get("/api/auth/user")).status).toBe(401);

      const login = await c.post("/api/auth/login", { email: "ALICE@example.com", password: "correct horse battery" });
      expect(login.status).toBe(200);
      expect(login.body.passwordHash).toBeUndefined();
    });

    it("rotates the session id on sign-in (no session fixation)", async () => {
      const c = client(app);
      await signUp(c);
      await c.post("/api/auth/logout");
      const first = await c.post("/api/auth/login", { email: "alice@example.com", password: "nope-nope-nope" });
      const login = await c.post("/api/auth/login", { email: "alice@example.com", password: "correct horse battery" });
      const before = first.headers["set-cookie"]?.[0];
      const after = login.headers["set-cookie"]?.[0];
      expect(after).toBeDefined();
      expect(after).not.toEqual(before);
      expect(after).toMatch(/HttpOnly/i);
      expect(after).toMatch(/SameSite=Lax/i);
    });

    it("gives the same answer for unknown emails and wrong passwords", async () => {
      const c = client(app);
      await signUp(c);
      const wrong = await c.post("/api/auth/login", { email: "alice@example.com", password: "wrong password" });
      const unknown = await c.post("/api/auth/login", { email: "nobody@example.com", password: "wrong password" });
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
    });

    it("rejects duplicate emails and weak input with field errors", async () => {
      const c = client(app);
      await signUp(c);
      const dup = await client(app).post("/api/auth/register", { email: "Alice@Example.com", password: "another long one", firstName: "A", lastName: "B" });
      expect(dup.status).toBe(409);
      const weak = await c.post("/api/auth/register", { email: "bad", password: "x", firstName: "", lastName: "B" });
      expect(weak.status).toBe(400);
      expect(Object.keys(weak.body.fields)).toEqual(expect.arrayContaining(["email", "password", "firstName"]));
    });

    it("lists only configured sign-in providers", async () => {
      expect((await client(app).get("/api/auth/providers")).body).toEqual({
        local: true,
        google: false,
        github: false,
        apple: false,
      });
    });
  });

  describe("zero-trust request handling", () => {
    it("blocks state-changing requests from other origins or without an origin (CSRF)", async () => {
      const c = client(app);
      await signUp(c);
      const evil = await c.agent.post("/api/links").set("Origin", "https://evil.example").send({ originalUrl: "https://e.com" });
      expect(evil.status).toBe(403);
      const none = await c.agent.post("/api/links").send({ originalUrl: "https://e.com" });
      expect(none.status).toBe(403);
      const referer = await c.agent.post("/api/links").set("Referer", `${ORIGIN}/`).send({ originalUrl: "https://e.com" });
      expect(referer.status).toBe(201);
    });

    it("can't make yourself admin through the profile (mass assignment)", async () => {
      const c = client(app);
      await signUp(c);
      const res = await c.patch("/api/profile", { firstName: "Mallory", lastName: "X", isAdmin: true, email: "x@y.z" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ firstName: "Mallory", isAdmin: false, email: "alice@example.com" });
      expect((await c.get("/api/admin/stats")).status).toBe(403);
    });

    it("can't read, change or delete someone else's link, or hand a link to someone else", async () => {
      const alice = client(app);
      await signUp(alice);
      const link = (await alice.post("/api/links", { originalUrl: "https://alice.example" })).body;

      const bob = client(app);
      const bobUser = await signUp(bob, "bob@example.com");
      expect((await bob.get(`/api/links/${link.id}`)).status).toBe(404);
      expect((await bob.patch(`/api/links/${link.id}`, { originalUrl: "https://bob.example" })).status).toBe(404);
      expect((await bob.delete(`/api/links/${link.id}`)).status).toBe(404);
      expect((await bob.get(`/api/links/${link.id}/analytics`)).status).toBe(404);
      expect((await bob.get(`/api/links/${link.id}/qr`)).status).toBe(404);

      const steal = await alice.patch(`/api/links/${link.id}`, { userId: bobUser.id });
      expect(steal.status).toBe(400);
      expect((await bob.get("/api/links")).body.total).toBe(0);
    });

    it("requires authentication for every private API", async () => {
      const anon = client(app);
      for (const path of ["/api/links", "/api/analytics/summary", "/api/profile/export", "/api/admin/stats"]) {
        expect((await anon.get(path)).status).toBe(401);
      }
    });

    it("sends security headers and hides framework details", async () => {
      const res = await client(app).get("/api/health");
      expect(res.body).toEqual({ status: "ok" }); // no memory/uptime/version leaks
      expect(res.headers["x-powered-by"]).toBeUndefined();
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
      expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    });

    it("rejects oversized and malformed bodies cleanly", async () => {
      const c = client(app);
      await signUp(c);
      expect((await c.post("/api/links", { originalUrl: `https://e.com/${"a".repeat(20_000)}` })).status).toBe(413);
      const bad = await c.agent.post("/api/links").set("Origin", ORIGIN).set("Content-Type", "application/json").send("{oops");
      expect(bad.status).toBe(400);
    });

    it("rate-limits repeated failed sign-ins", async () => {
      const limited = await makeApp({ rateLimits: { auth: 3 } });
      const c = client(limited);
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) {
        statuses.push((await c.post("/api/auth/login", { email: "x@example.com", password: "wrong password" })).status);
      }
      expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
      expect(statuses.at(-1)).toBe(429);
    });
  });

  describe("links", () => {
    it("creates, lists, searches, updates and deletes links", async () => {
      const c = client(app);
      await signUp(c);
      const created = await c.post("/api/links", { originalUrl: "https://example.com/docs", title: "Docs", customAlias: "my-docs" });
      expect(created.status).toBe(201);
      expect(created.body).toMatchObject({ shortCode: "my-docs", shortUrl: `${ORIGIN}/my-docs`, isCustomAlias: true, clickCount: 0 });
      await c.post("/api/links", { originalUrl: "https://other.example" });

      const list = await c.get("/api/links?search=docs");
      expect(list.body.total).toBe(1);
      expect((await c.get("/api/links")).body.total).toBe(2);

      const updated = await c.patch(`/api/links/${created.body.id}`, { title: "Docs v2", isActive: false, maxClicks: 5 });
      expect(updated.body).toMatchObject({ title: "Docs v2", isActive: false, maxClicks: 5 });

      expect((await c.delete(`/api/links/${created.body.id}`)).status).toBe(204);
      expect((await c.get(`/api/links/${created.body.id}`)).status).toBe(404);
    });

    it("rejects taken (case-insensitive) and reserved aliases, and links to itself", async () => {
      const c = client(app);
      await signUp(c);
      await c.post("/api/links", { originalUrl: "https://a.example", customAlias: "promo" });
      expect((await c.post("/api/links", { originalUrl: "https://b.example", customAlias: "PROMO" })).status).toBe(409);
      expect((await c.post("/api/links", { originalUrl: "https://b.example", customAlias: "admin" })).status).toBe(400);
      expect((await c.post("/api/links", { originalUrl: `${ORIGIN}/promo` })).status).toBe(400);
    });

    it("never returns a link password, only whether one is set", async () => {
      const c = client(app);
      await signUp(c);
      const res = await c.post("/api/links", { originalUrl: "https://secret.example", password: "letmein" });
      expect(res.body.hasPassword).toBe(true);
      expect(JSON.stringify(res.body)).not.toContain("letmein");
      const cleared = await c.patch(`/api/links/${res.body.id}`, { removePassword: true });
      expect(cleared.body.hasPassword).toBe(false);
    });
  });

  describe("redirects", () => {
    async function link(body: object) {
      const c = client(app);
      await signUp(c, `${Math.random().toString(36).slice(2)}@example.com`);
      return { c, link: (await c.post("/api/links", body)).body };
    }

    it("redirects and records an anonymous click (no IP stored)", async () => {
      const { c, link: l } = await link({ originalUrl: "https://dest.example/page" });
      const res = await client(app)
        .agent.get(`/${l.shortCode}`)
        .set("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile Safari/604.1")
        .set("Referer", "https://news.example.org/a?b=c")
        .set("X-Forwarded-For", "85.214.132.117");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("https://dest.example/page");
      expect(res.headers["cache-control"]).toContain("no-store");
      await new Promise((r) => setTimeout(r, 150)); // click is recorded asynchronously

      const { db } = await database();
      const rows = (await db.execute(sql`select * from clicks`)).rows as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ device: "mobile", os: "iOS", referrer_host: "news.example.org" });
      expect(Object.keys(rows[0])).not.toEqual(expect.arrayContaining(["ip_address", "user_agent", "city"]));
      expect((await c.get(`/api/links/${l.id}`)).body.clickCount).toBe(1);
    });

    it("is case-insensitive, skips bots, and handles unknown, disabled, expired and limited links", async () => {
      const { c, link: l } = await link({ originalUrl: "https://dest.example", customAlias: "Launch", maxClicks: 1 });
      expect((await client(app).agent.get("/launch")).status).toBe(302);
      await client(app).agent.get("/launch").set("User-Agent", "Twitterbot/1.0"); // not counted
      await new Promise((r) => setTimeout(r, 150));
      expect((await client(app).agent.get("/launch")).status).toBe(410); // limit of 1 reached

      expect((await client(app).agent.get("/does-not-exist")).status).toBe(404);

      const other = (await c.post("/api/links", { originalUrl: "https://dest.example" })).body;
      await c.patch(`/api/links/${other.id}`, { isActive: false });
      expect((await client(app).agent.get(`/${other.shortCode}`)).status).toBe(410);

      const { db } = await database();
      await db.execute(sql`update shortened_urls set expires_at = now() - interval '1 minute' where id = ${other.id}`);
      await c.patch(`/api/links/${other.id}`, { isActive: true });
      const expired = await client(app).agent.get(`/${other.shortCode}`);
      expect(expired.status).toBe(410);
      expect(expired.text).toContain("expired");
    });

    it("protects links with a password via an unlock form, never the URL", async () => {
      const { link: l } = await link({ originalUrl: "https://private.example", password: "open sesame" });
      const visitor = client(app);
      const form = await visitor.agent.get(`/${l.shortCode}?password=open%20sesame`);
      expect(form.status).toBe(401); // a password in the query string is ignored
      expect(form.text).toContain(`action="/${l.shortCode}/unlock"`);
      expect(form.headers["content-security-policy"]).toContain("form-action 'self' https: http:");

      const wrong = await visitor.agent.post(`/${l.shortCode}/unlock`).set("Origin", ORIGIN).type("form").send({ password: "nope" });
      expect(wrong.status).toBe(401);
      expect(wrong.text).toContain("Incorrect password");

      const right = await visitor.agent.post(`/${l.shortCode}/unlock`).set("Origin", ORIGIN).type("form").send({ password: "open sesame" });
      expect(right.status).toBe(303);
      expect(right.headers.location).toBe("https://private.example");

      const csrf = await visitor.agent.post(`/${l.shortCode}/unlock`).set("Origin", "https://evil.example").type("form").send({ password: "open sesame" });
      expect(csrf.status).toBe(403);
    });

    it("leaves app pages and short codes containing words like 'api' alone", async () => {
      const { link: l } = await link({ originalUrl: "https://capital.example", customAlias: "capital" });
      expect((await client(app).agent.get("/capital")).status).toBe(302); // the old code skipped anything containing "api"
      expect((await client(app).agent.get("/signin")).status).toBe(404); // falls through to the SPA (not mounted in tests)
      expect(l.shortCode).toBe("capital");
    });
  });

  describe("analytics", () => {
    it("reports real numbers (no invented demo data) and exports safe CSV", async () => {
      const c = client(app);
      await signUp(c);
      const empty = (await c.get("/api/analytics/summary?days=7")).body;
      expect(empty).toMatchObject({ totalLinks: 0, totalClicks: 0, clicksInPeriod: 0, countries: [], topLinks: [] });
      expect(empty.dailyClicks).toHaveLength(7);

      const l = (await c.post("/api/links", { originalUrl: "https://dest.example", customAlias: "stats" })).body;
      for (const ip of ["85.214.132.117", "85.214.132.117", "8.8.8.8"]) {
        await client(app).agent.get("/stats").set("X-Forwarded-For", ip).set("User-Agent", "Mozilla/5.0 (Windows NT 10.0) Chrome/120");
      }
      await new Promise((r) => setTimeout(r, 200));
      const summary = (await c.get("/api/analytics/summary?days=7")).body;
      expect(summary.totalClicks).toBe(3);
      expect(summary.clicksInPeriod).toBe(3);
      expect(summary.browsers).toEqual([{ label: "Chrome", clicks: 3, percentage: 100 }]);
      expect(summary.topLinks[0]).toMatchObject({ shortCode: "stats", clicks: 3 });
      expect(summary.recentClicks).toHaveLength(3);
      expect(summary.recentClicks[0]).toMatchObject({ shortCode: "stats", browser: "Chrome" });
      expect(Object.keys(summary.recentClicks[0]).sort()).toEqual(
        ["browser", "clickedAt", "country", "device", "referrerHost", "shortCode"], // nothing identifying
      );
      expect((await c.get(`/api/links/${l.id}/analytics?days=30`)).body.totalClicks).toBe(3);

      const csv = await c.get(`/api/links/${l.id}/clicks.csv`);
      expect(csv.headers["content-type"]).toContain("text/csv");
      expect(csv.text.split("\r\n")[0]).toBe("clicked_at,short_code,country,device,browser,os,referrer");
      expect(csv.text.trim().split("\r\n")).toHaveLength(4);
    });
  });

  describe("QR codes", () => {
    it("renders PNG/SVG and saves custom styling", async () => {
      const c = client(app);
      await signUp(c);
      const l = (await c.post("/api/links", { originalUrl: "https://dest.example" })).body;
      const png = await c.get(`/api/links/${l.id}/qr`).buffer(true);
      expect(png.headers["content-type"]).toBe("image/png");
      expect(png.body.subarray(0, 4).toString("hex")).toBe("89504e47");
      const svg = await c.get(`/api/links/${l.id}/qr?format=svg&download=1`);
      expect(svg.headers["content-type"]).toContain("image/svg+xml");
      expect(svg.headers["content-disposition"]).toContain(`qr-${l.shortCode}.svg`);

      const saved = await c.put(`/api/links/${l.id}/qr/settings`, { size: 300, darkColor: "#1d4ed8", lightColor: "#ffffff", errorCorrection: "H" });
      expect(saved.body).toMatchObject({ size: 300, darkColor: "#1d4ed8", customized: true });
      expect((await c.put(`/api/links/${l.id}/qr/settings`, { darkColor: "red; background:url(x)" })).status).toBe(400);
      const styled = await c.get(`/api/links/${l.id}/qr?format=svg`).buffer(true).parse((res, cb) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => cb(null, data));
      });
      expect(styled.body).toContain("#1d4ed8");
      expect((await c.delete(`/api/links/${l.id}/qr/settings`)).status).toBe(204);
      expect((await c.get(`/api/links/${l.id}/qr/settings`)).body.customized).toBe(false);
    });
  });

  describe("admin", () => {
    it("is admin-only, can moderate links and manage admins, but not demote itself", async () => {
      const admin = client(app);
      const adminUser = await signUp(admin, "root@example.com");
      await makeAdmin("root@example.com");
      const user = client(app);
      const regular = await signUp(user, "user@example.com");
      const l = (await user.post("/api/links", { originalUrl: "https://spam.example" })).body;

      expect((await user.get("/api/admin/stats")).status).toBe(403);
      const stats = (await admin.get("/api/admin/stats")).body;
      expect(stats).toMatchObject({ totalUsers: 2, totalLinks: 1, totalClicks: 0 });

      expect((await admin.get("/api/admin/links")).body.items[0]).toMatchObject({ id: l.id, owner: { email: "user@example.com" } });
      expect((await admin.patch(`/api/admin/links/${l.id}`, { isActive: false })).body.isActive).toBe(false);
      expect((await client(app).agent.get(`/${l.shortCode}`)).status).toBe(410);

      expect((await admin.patch(`/api/admin/users/${regular.id}`, { isAdmin: true })).body.isAdmin).toBe(true);
      expect((await admin.patch(`/api/admin/users/${adminUser.id}`, { isAdmin: false })).status).toBe(400);
      expect((await admin.get("/api/admin/users")).body.total).toBe(2);
    });

    it("revoking admin takes effect immediately (privileges aren't cached in the session)", async () => {
      const admin = client(app);
      await signUp(admin, "root@example.com");
      await makeAdmin("root@example.com");
      expect((await admin.get("/api/admin/stats")).status).toBe(200);
      const { db } = await database();
      await db.execute(sql`update users set is_admin = false where email = 'root@example.com'`);
      expect((await admin.get("/api/admin/stats")).status).toBe(403);
    });
  });

  describe("profile", () => {
    it("changes password (requires the current one), exports data and deletes everything", async () => {
      const c = client(app);
      await signUp(c);
      expect((await c.post("/api/profile/password", { currentPassword: "wrong", newPassword: "brand new passphrase" })).status).toBe(400);
      expect((await c.post("/api/profile/password", { currentPassword: "correct horse battery", newPassword: "brand new passphrase" })).status).toBe(204);
      await c.post("/api/auth/logout");
      expect((await c.post("/api/auth/login", { email: "alice@example.com", password: "brand new passphrase" })).status).toBe(200);

      const l = (await c.post("/api/links", { originalUrl: "https://dest.example", customAlias: "bye" })).body;
      await client(app).agent.get("/bye");
      const exported = await c.get("/api/profile/export");
      expect(exported.headers["content-disposition"]).toContain("linkfusion-export.json");
      expect(exported.body.links[0].id).toBe(l.id);

      expect((await c.delete("/api/profile", { confirm: "nope" })).status).toBe(400);
      expect((await c.delete("/api/profile", { confirm: "DELETE" })).status).toBe(204);
      expect((await c.get("/api/auth/user")).status).toBe(401);
      expect((await client(app).agent.get("/bye")).status).toBe(404);
      const { db } = await database();
      const counts = (await db.execute(sql`select (select count(*) from users) u, (select count(*) from shortened_urls) l, (select count(*) from clicks) c`)).rows[0];
      expect(counts).toEqual({ u: "0", l: "0", c: "0" });
    });
  });

  describe("demo data (opt-in seed)", () => {
    it("creates a demo account with a random password, rich analytics, and resets cleanly", async () => {
      const real = client(app);
      await signUp(real);
      await real.post("/api/links", { originalUrl: "https://dest.example", customAlias: "mine" });

      const { db } = await database();
      const first = await seedDemo(db, { totalClicks: 600 });
      const second = await seedDemo(db, { totalClicks: 600 });
      expect(second.password).not.toBe(first.password); // never a fixed, guessable password

      const demo = client(app);
      expect((await demo.post("/api/auth/login", { email: first.email, password: first.password })).status).toBe(401);
      const login = await demo.post("/api/auth/login", { email: second.email, password: second.password });
      expect(login.status).toBe(200);
      expect(login.body.isAdmin).toBe(false);

      const summary = (await demo.get("/api/analytics/summary?days=90")).body;
      expect(summary.totalLinks).toBe(8);
      expect(summary.totalClicks).toBe(second.clicks); // reseeding replaced the first run's clicks
      expect(second.clicks).toBeGreaterThan(550);
      expect(summary.countries.length).toBeGreaterThan(10);
      expect(summary.devices.map((d: { label: string }) => d.label)).toEqual(expect.arrayContaining(["mobile", "desktop"]));
      expect(summary.recentClicks).toHaveLength(8);

      // Headline numbers, breakdowns and the per-day chart count the same window.
      const month = (await demo.get("/api/analytics/summary?days=30")).body;
      const sum = (rows: Array<{ clicks: number }>) => rows.reduce((n, r) => n + r.clicks, 0);
      expect(sum(month.dailyClicks)).toBe(month.clicksInPeriod);
      expect(sum(month.devices)).toBe(month.clicksInPeriod);
      expect(sum(month.browsers)).toBe(month.clicksInPeriod);

      // The real user's data is untouched and still private.
      expect((await real.get("/api/links")).body.items.map((l: { shortCode: string }) => l.shortCode)).toEqual(["mine"]);
      expect((await real.get("/api/analytics/summary?days=90")).body.totalClicks).toBe(0);
    });
  });
});
