import { and, count, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { clicks, shortenedUrls } from "@shared/schema";
import type { Database } from "../db";

export type NewClick = {
  urlId: string;
  country: string | null;
  device: string;
  browser: string;
  os: string;
  referrerHost: string | null;
};

/** Scope for analytics: one user's links (optionally a single link), or everything (admin). */
export type ClickScope = { userId?: string; linkId?: string; since: Date };

export function createClickRepository(db: Database) {
  function where(scope: ClickScope): SQL {
    const parts: SQL[] = [gte(clicks.clickedAt, scope.since)];
    if (scope.userId) parts.push(eq(shortenedUrls.userId, scope.userId));
    if (scope.linkId) parts.push(eq(clicks.urlId, scope.linkId));
    return and(...parts)!;
  }

  return {
    async insert(click: NewClick): Promise<void> {
      await db.insert(clicks).values(click);
    },

    async total(scope: Omit<ClickScope, "since">): Promise<number> {
      const parts: SQL[] = [];
      if (scope.userId) parts.push(eq(shortenedUrls.userId, scope.userId));
      if (scope.linkId) parts.push(eq(clicks.urlId, scope.linkId));
      const [{ n }] = await db
        .select({ n: count() })
        .from(clicks)
        .innerJoin(shortenedUrls, eq(shortenedUrls.id, clicks.urlId))
        .where(parts.length ? and(...parts) : undefined);
      return Number(n);
    },

    async daily(scope: ClickScope): Promise<Array<{ date: string; clicks: number }>> {
      const day = sql<string>`to_char(date_trunc('day', ${clicks.clickedAt}), 'YYYY-MM-DD')`;
      const rows = await db
        .select({ date: day, clicks: count() })
        .from(clicks)
        .innerJoin(shortenedUrls, eq(shortenedUrls.id, clicks.urlId))
        .where(where(scope))
        .groupBy(day)
        .orderBy(day);
      return rows.map((r) => ({ date: r.date, clicks: Number(r.clicks) }));
    },

    async breakdown(scope: ClickScope, column: PgColumn, limit = 10): Promise<Array<{ label: string | null; clicks: number }>> {
      const rows = await db
        .select({ label: sql<string | null>`${column}`, clicks: count() })
        .from(clicks)
        .innerJoin(shortenedUrls, eq(shortenedUrls.id, clicks.urlId))
        .where(where(scope))
        .groupBy(column)
        .orderBy(desc(count()))
        .limit(limit);
      return rows.map((r) => ({ label: r.label, clicks: Number(r.clicks) }));
    },

    async topLinks(scope: ClickScope, limit = 5) {
      const rows = await db
        .select({
          id: shortenedUrls.id,
          shortCode: shortenedUrls.shortCode,
          title: shortenedUrls.title,
          clicks: count(),
        })
        .from(clicks)
        .innerJoin(shortenedUrls, eq(shortenedUrls.id, clicks.urlId))
        .where(where(scope))
        .groupBy(shortenedUrls.id)
        .orderBy(desc(count()))
        .limit(limit);
      return rows.map((r) => ({ ...r, clicks: Number(r.clicks) }));
    },

    async rows(scope: ClickScope, limit = 50_000) {
      return db
        .select({
          clickedAt: clicks.clickedAt,
          shortCode: shortenedUrls.shortCode,
          country: clicks.country,
          device: clicks.device,
          browser: clicks.browser,
          os: clicks.os,
          referrerHost: clicks.referrerHost,
        })
        .from(clicks)
        .innerJoin(shortenedUrls, eq(shortenedUrls.id, clicks.urlId))
        .where(where(scope))
        .orderBy(desc(clicks.clickedAt))
        .limit(limit);
    },
  };
}

export type ClickRepository = ReturnType<typeof createClickRepository>;
