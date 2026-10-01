/**
 * Opt-in demo content for local development, screenshots and demos.
 *
 * Creates one ordinary account (random password, never a built-in one) with a
 * set of links and synthetic clicks spread over the last 90 days, so every chart
 * has something to show. It writes through the same tables as real traffic and
 * is clearly separated from it: demo short codes start with "demo-" and the
 * account can be deleted from its profile page like any other.
 */
import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { clicks, qrSettings, shortenedUrls, users } from "@shared/schema";
import type { Database } from "../db";
import { hashPassword } from "./passwords";

export const DEMO_DAYS = 90;

/** Small seeded PRNG (mulberry32) so the demo looks the same on every run. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

type Weighted<T> = ReadonlyArray<readonly [T, number]>;

function pick<T>(rand: () => number, options: Weighted<T>): T {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, weight] of options) {
    if ((r -= weight) < 0) return value;
  }
  return options[options.length - 1]![0];
}

const COUNTRIES: Weighted<string | null> = [
  ["DE", 22], ["US", 18], ["GB", 9], ["FR", 6], ["NL", 5], ["IN", 5], ["NG", 4], ["BR", 4], ["CA", 4],
  ["ES", 3], ["IT", 3], ["PL", 3], ["SE", 2], ["CH", 2], ["AT", 2], ["JP", 2], ["AU", 2], ["TR", 2],
  ["MX", 1], ["ZA", 1], ["KE", 1], ["IE", 1], ["DK", 1], ["NO", 1], ["SG", 1], ["KR", 1], ["AR", 1],
  ["PT", 1], ["BE", 1], ["GH", 1], [null, 1],
];

type Platform = { device: string; os: string; browsers: Weighted<string> };
const PLATFORMS: Weighted<Platform> = [
  [{ device: "mobile", os: "iOS", browsers: [["Safari", 8], ["Chrome", 2]] }, 30],
  [{ device: "mobile", os: "Android", browsers: [["Chrome", 8], ["Samsung Internet", 2], ["Firefox", 1]] }, 24],
  [{ device: "desktop", os: "Windows", browsers: [["Chrome", 6], ["Edge", 3], ["Firefox", 2]] }, 22],
  [{ device: "desktop", os: "macOS", browsers: [["Chrome", 5], ["Safari", 4], ["Firefox", 1]] }, 14],
  [{ device: "desktop", os: "Linux", browsers: [["Firefox", 5], ["Chrome", 4]] }, 5],
  [{ device: "tablet", os: "iPadOS", browsers: [["Safari", 1]] }, 5],
];

const REFERRERS: Weighted<string | null> = [
  [null, 30], ["t.co", 14], ["www.linkedin.com", 13], ["www.google.com", 10], ["github.com", 9],
  ["news.ycombinator.com", 6], ["www.reddit.com", 6], ["l.facebook.com", 4], ["substack.com", 4],
  ["medium.com", 3], ["duckduckgo.com", 1],
];

const HOURS: Weighted<number> = Array.from({ length: 24 }, (_, h) => [h, h < 6 ? 1 : h < 9 ? 3 : h < 20 ? 6 : 3] as const);

type DemoLink = {
  code: string;
  title: string;
  url: string;
  weight: number; // relative popularity
  age: number; // created this many days ago
  maxClicks?: number;
  password?: boolean;
  expiredDaysAgo?: number;
};

const LINKS: DemoLink[] = [
  { code: "demo-launch", title: "Product launch post", url: "https://github.com/codemarquis/LinkFusion", weight: 30, age: 88 },
  { code: "demo-docs", title: "Deployment guide", url: "https://github.com/codemarquis/LinkFusion/blob/main/docs/deployment.md", weight: 18, age: 80 },
  { code: "demo-talk", title: "Conference talk recording", url: "https://www.youtube.com/", weight: 14, age: 45 },
  { code: "demo-newsletter", title: "October newsletter", url: "https://substack.com/", weight: 12, age: 30 },
  { code: "demo-hiring", title: "We're hiring: DevOps engineer", url: "https://www.linkedin.com/jobs/", weight: 10, age: 60 },
  { code: "demo-survey", title: "Feedback survey (first 1,000)", url: "https://forms.gle/", weight: 6, age: 20, maxClicks: 1000 },
  { code: "demo-private", title: "Partner pricing (password protected)", url: "https://example.com/pricing", weight: 4, age: 15, password: true },
  { code: "demo-meetup", title: "Berlin meetup RSVP (expired)", url: "https://www.meetup.com/", weight: 6, age: 70, expiredDaysAgo: 40 },
];

export type DemoClick = {
  urlId: string;
  country: string | null;
  device: string;
  browser: string;
  os: string;
  referrerHost: string | null;
  clickedAt: Date;
};

/** Daily click volume: slow growth, weekday bumps and a couple of viral spikes. */
export function generateClicks(
  links: ReadonlyArray<{ id: string; weight: number; age: number; expiredDaysAgo?: number }>,
  opts: { now: Date; total: number; seed?: number },
): DemoClick[] {
  const rand = prng(opts.seed ?? 42);
  const dayWeights: Weighted<number> = Array.from({ length: DEMO_DAYS }, (_, ago) => {
    const date = new Date(opts.now.getTime() - ago * 86_400_000);
    const weekday = [0.6, 1.1, 1.2, 1.15, 1.1, 1.0, 0.7][date.getUTCDay()]!;
    const growth = 0.35 + ((DEMO_DAYS - ago) / DEMO_DAYS) * 0.9;
    const spike = ago === 61 ? 3.2 : ago === 12 ? 2.4 : ago === 11 ? 1.6 : 1;
    return [ago, weekday * growth * spike] as const;
  });

  const out: DemoClick[] = [];
  for (let i = 0; i < opts.total; i++) {
    const ago = pick(rand, dayWeights);
    const live = links.filter((l) => l.age >= ago && (l.expiredDaysAgo === undefined || ago > l.expiredDaysAgo));
    if (live.length === 0) continue;
    const link = pick(rand, live.map((l) => [l, l.weight] as const));
    const platform = pick(rand, PLATFORMS);
    const clickedAt = new Date(opts.now.getTime() - ago * 86_400_000);
    clickedAt.setUTCHours(pick(rand, HOURS), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
    if (clickedAt > opts.now) clickedAt.setTime(opts.now.getTime() - Math.floor(rand() * 3_600_000));
    out.push({
      urlId: link.id,
      country: pick(rand, COUNTRIES),
      device: platform.device,
      os: platform.os,
      browser: pick(rand, platform.browsers),
      referrerHost: pick(rand, REFERRERS),
      clickedAt,
    });
  }
  return out;
}

export type DemoResult = { email: string; password: string; links: number; clicks: number };

/** (Re)creates the demo account. A previous demo account with this email is removed first. */
export async function seedDemo(
  db: Database,
  opts: { email?: string; now?: Date; totalClicks?: number } = {},
): Promise<DemoResult> {
  const email = (opts.email ?? "demo@linkfusion.local").toLowerCase();
  const now = opts.now ?? new Date();
  const password = randomBytes(12).toString("base64url");
  const passwordHash = await hashPassword(password);
  const linkPasswordHash = await hashPassword(randomBytes(12).toString("base64url"));
  const day = (ago: number) => new Date(now.getTime() - ago * 86_400_000);

  return db.transaction(async (tx) => {
    await tx.delete(users).where(eq(users.email, email));
    // Demo codes belong to the demo; clear leftovers from an older demo account.
    await tx.delete(shortenedUrls).where(inArray(shortenedUrls.shortCode, LINKS.map((l) => l.code)));

    const [user] = await tx
      .insert(users)
      .values({ email, firstName: "Demo", lastName: "User", passwordHash, createdAt: day(DEMO_DAYS) })
      .returning();

    const rows = await tx
      .insert(shortenedUrls)
      .values(
        LINKS.map((l) => ({
          userId: user!.id,
          originalUrl: l.url,
          shortCode: l.code,
          isCustomAlias: true,
          title: l.title,
          passwordHash: l.password ? linkPasswordHash : null,
          maxClicks: l.maxClicks ?? null,
          expiresAt: l.expiredDaysAgo === undefined ? null : day(l.expiredDaysAgo),
          createdAt: day(l.age),
          updatedAt: day(l.age),
        })),
      )
      .returning({ id: shortenedUrls.id, shortCode: shortenedUrls.shortCode });

    const byCode = new Map(rows.map((r) => [r.shortCode, r.id]));
    const generated = generateClicks(
      LINKS.map((l) => ({ ...l, id: byCode.get(l.code)! })),
      { now, total: opts.totalClicks ?? 4200 },
    );
    for (let i = 0; i < generated.length; i += 1000) {
      await tx.insert(clicks).values(generated.slice(i, i + 1000));
    }

    await tx.insert(qrSettings).values([
      { urlId: byCode.get("demo-launch")!, size: 512, darkColor: "#1d4ed8", lightColor: "#ffffff", errorCorrection: "Q" },
      { urlId: byCode.get("demo-talk")!, size: 768, darkColor: "#7c3aed", lightColor: "#faf5ff", errorCorrection: "H" },
      { urlId: byCode.get("demo-hiring")!, size: 512, darkColor: "#047857", lightColor: "#ecfdf5", errorCorrection: "M" },
    ]);

    return { email, password, links: rows.length, clicks: generated.length };
  });
}
