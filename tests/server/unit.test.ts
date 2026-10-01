import { describe, expect, it } from "vitest";
import { createLinkSchema, registerSchema, updateLinkSchema } from "@shared/api";
import { loadConfig } from "../../server/config";
import { clickFacts, countryForIp, referrerHost } from "../../server/services/clickContext";
import { toCsv } from "../../server/services/csv";
import { generateShortCode } from "../../server/services/linkService";
import { unlockPage, unavailablePage } from "../../server/services/pages";
import { hashPassword, verifyPassword } from "../../server/services/passwords";
import { parseUserAgent } from "../../server/services/userAgent";

describe("user agent parsing", () => {
  it.each([
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0", "desktop", "Edge", "Windows"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Version/17.0 Mobile Safari/604.1", "mobile", "Safari", "iOS"],
    ["Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1 CriOS/119 Safari/604.1", "tablet", "Chrome", "iOS"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", "mobile", "Chrome", "Android"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0; rv:121.0) Gecko/20100101 Firefox/121.0", "desktop", "Firefox", "macOS"],
    ["Twitterbot/1.0", "bot", "Other", "Other"],
  ])("%s", (ua, device, browser, os) => {
    expect(parseUserAgent(ua)).toEqual({ device, browser, os });
  });
});

describe("passwords", () => {
  it("hashes with a salt and verifies", async () => {
    const a = await hashPassword("s3cret-passphrase");
    const b = await hashPassword("s3cret-passphrase");
    expect(a).not.toEqual(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("s3cret-passphrase", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "plaintext")).toBe(false);
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas and quotes special characters", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(\"http://evil\")", "x,y"], ["+1", "-2"], ["@cmd", 'say "hi"']]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain(`"x,y"`);
    expect(csv).toContain("'+1,'-2");
    expect(csv).toContain(`'@cmd,"say ""hi"""`);
  });
});

describe("validation", () => {
  it.each(["javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://example.com", "https://user:pass@example.com", "not a url"])(
    "rejects %s",
    (originalUrl) => expect(createLinkSchema.safeParse({ originalUrl }).success).toBe(false),
  );
  it("accepts http(s) URLs", () => {
    expect(createLinkSchema.parse({ originalUrl: " https://example.com/a?b=1 " }).originalUrl).toBe("https://example.com/a?b=1");
  });
  it.each(["api", "Admin", "ab", "-start", "has space", "x".repeat(33), "signin"])("rejects alias %s", (customAlias) =>
    expect(createLinkSchema.safeParse({ originalUrl: "https://e.com", customAlias }).success).toBe(false),
  );
  it("rejects fields that must never come from the client", () => {
    expect(updateLinkSchema.safeParse({ userId: "someone-else" }).success).toBe(false);
    expect(updateLinkSchema.safeParse({ shortCode: "steal" }).success).toBe(false);
  });
  it("requires strong-enough passwords and clean names", () => {
    expect(registerSchema.safeParse({ email: "a@b.co", password: "short", firstName: "A", lastName: "B" }).success).toBe(false);
    expect(registerSchema.safeParse({ email: "a@b.co", password: "long enough pw", firstName: "<script>", lastName: "B" }).success).toBe(false);
  });
});

describe("click privacy", () => {
  it("keeps only the referrer host and an offline country code", () => {
    expect(referrerHost("https://news.example.org/story?id=1&token=secret", "lf.test")).toBe("news.example.org");
    expect(referrerHost("http://lf.test/somewhere", "lf.test")).toBeNull();
    expect(referrerHost("garbage", "lf.test")).toBeNull();
    expect(countryForIp("85.214.132.117")).toBe("DE");
    expect(countryForIp("::ffff:85.214.132.117")).toBe("DE");
    expect(countryForIp("10.0.0.1")).toBeNull();
    const facts = clickFacts({ ip: "85.214.132.117", userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/120", referrer: undefined, ownHost: "lf.test" });
    expect(Object.keys(facts).sort()).toEqual(["browser", "country", "device", "os", "referrerHost"]);
  });
});

describe("short codes", () => {
  it("are 7 unambiguous characters", () => {
    for (let i = 0; i < 200; i++) expect(generateShortCode()).toMatch(/^[a-km-zA-HJ-NP-Z2-9]{7}$/);
  });
});

describe("server-rendered pages escape their input", () => {
  it("unlock and unavailable pages", () => {
    const html = unlockPage(`x"><script>alert(1)</script>`, `<img src=x onerror=alert(1)>`);
    expect(html).not.toContain("<script>alert(1)");
    expect(html).not.toContain("<img src=x");
    expect(unavailablePage("nope")).toContain("Link not found");
  });
});

describe("config", () => {
  const base = { DATABASE_URL: "postgresql://u:p@localhost/db" };
  it("refuses insecure production settings", () => {
    expect(() => loadConfig({ ...base, NODE_ENV: "production" } as NodeJS.ProcessEnv)).toThrow(/SESSION_SECRET/);
    expect(() =>
      loadConfig({ ...base, NODE_ENV: "production", SESSION_SECRET: "x".repeat(40), PUBLIC_BASE_URL: "http://insecure.example" } as NodeJS.ProcessEnv),
    ).toThrow(/https/);
  });
  it("never uses a fixed default secret in development", () => {
    const a = loadConfig(base as NodeJS.ProcessEnv).sessionSecret;
    const b = loadConfig(base as NodeJS.ProcessEnv).sessionSecret;
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(64);
  });
});
