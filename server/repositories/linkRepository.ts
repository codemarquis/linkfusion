/**
 * Link queries. Every query that touches a user's links filters by owner in
 * SQL (WHERE user_id = …), so a missing check elsewhere can't leak or modify
 * another user's data.
 */
import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { clicks, shortenedUrls, users, type LinkRow } from "@shared/schema";
import type { Database } from "../db";

export type LinkWithStats = LinkRow & { clickCount: number; ownerEmail?: string };

export type NewLink = {
  userId: string;
  originalUrl: string;
  shortCode: string;
  isCustomAlias: boolean;
  title?: string | null;
  passwordHash?: string | null;
  expiresAt?: Date | null;
  maxClicks?: number | null;
};

export type LinkChanges = Partial<
  Pick<LinkRow, "originalUrl" | "title" | "passwordHash" | "expiresAt" | "maxClicks" | "isActive">
>;

// Explicit table names: inside a subquery Drizzle renders bare column names,
// which made "url_id = id" compare against the click's own id.
const clickCount = sql<number>`(select count(*) from "clicks" where "clicks"."url_id" = "shortened_urls"."id")`.mapWith(
  Number,
);

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function createLinkRepository(db: Database) {
  return {
    async create(link: NewLink): Promise<LinkRow> {
      const [row] = await db.insert(shortenedUrls).values(link).returning();
      return row;
    },

    async findByShortCode(code: string): Promise<LinkRow | undefined> {
      const [row] = await db
        .select()
        .from(shortenedUrls)
        .where(sql`lower(${shortenedUrls.shortCode}) = ${code.toLowerCase()}`);
      return row;
    },

    async shortCodeExists(code: string): Promise<boolean> {
      return (await this.findByShortCode(code)) !== undefined;
    },

    async findOwned(userId: string, id: string): Promise<LinkWithStats | undefined> {
      const [row] = await db
        .select({ link: shortenedUrls, clickCount })
        .from(shortenedUrls)
        .where(and(eq(shortenedUrls.id, id), eq(shortenedUrls.userId, userId)));
      return row ? { ...row.link, clickCount: row.clickCount } : undefined;
    },

    async listOwned(
      userId: string,
      opts: { limit: number; offset: number; search?: string },
    ): Promise<{ rows: LinkWithStats[]; total: number }> {
      const filters: SQL[] = [eq(shortenedUrls.userId, userId)];
      if (opts.search) {
        const pattern = `%${escapeLike(opts.search)}%`;
        filters.push(
          or(
            ilike(shortenedUrls.shortCode, pattern),
            ilike(shortenedUrls.originalUrl, pattern),
            ilike(shortenedUrls.title, pattern),
          )!,
        );
      }
      const where = and(...filters);
      const rows = await db
        .select({ link: shortenedUrls, clickCount })
        .from(shortenedUrls)
        .where(where)
        .orderBy(desc(shortenedUrls.createdAt))
        .limit(opts.limit)
        .offset(opts.offset);
      const [{ n }] = await db.select({ n: count() }).from(shortenedUrls).where(where);
      return { rows: rows.map((r) => ({ ...r.link, clickCount: r.clickCount })), total: Number(n) };
    },

    async listAll(limit: number, offset: number): Promise<{ rows: LinkWithStats[]; total: number }> {
      const rows = await db
        .select({ link: shortenedUrls, clickCount, ownerEmail: users.email })
        .from(shortenedUrls)
        .innerJoin(users, eq(users.id, shortenedUrls.userId))
        .orderBy(desc(shortenedUrls.createdAt))
        .limit(limit)
        .offset(offset);
      const [{ n }] = await db.select({ n: count() }).from(shortenedUrls);
      return {
        rows: rows.map((r) => ({ ...r.link, clickCount: r.clickCount, ownerEmail: r.ownerEmail })),
        total: Number(n),
      };
    },

    async updateOwned(userId: string, id: string, changes: LinkChanges): Promise<LinkRow | undefined> {
      const [row] = await db
        .update(shortenedUrls)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(eq(shortenedUrls.id, id), eq(shortenedUrls.userId, userId)))
        .returning();
      return row;
    },

    async setActive(id: string, isActive: boolean): Promise<LinkRow | undefined> {
      const [row] = await db
        .update(shortenedUrls)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(shortenedUrls.id, id))
        .returning();
      return row;
    },

    async deleteOwned(userId: string, id: string): Promise<boolean> {
      const rows = await db
        .delete(shortenedUrls)
        .where(and(eq(shortenedUrls.id, id), eq(shortenedUrls.userId, userId)))
        .returning({ id: shortenedUrls.id });
      return rows.length > 0;
    },

    async countClicks(id: string): Promise<number> {
      const [{ n }] = await db.select({ n: count() }).from(clicks).where(eq(clicks.urlId, id));
      return Number(n);
    },

    async countAll(userId?: string): Promise<{ total: number; active: number }> {
      const owner = userId ? eq(shortenedUrls.userId, userId) : undefined;
      const [{ total, active }] = await db
        .select({
          total: count(),
          active: sql<number>`count(*) filter (where ${shortenedUrls.isActive})`.mapWith(Number),
        })
        .from(shortenedUrls)
        .where(owner);
      return { total: Number(total), active };
    },
  };
}

export type LinkRepository = ReturnType<typeof createLinkRepository>;
