import { and, count, desc, eq, sql } from "drizzle-orm";
import { oauthAccounts, users, type UserRow } from "@shared/schema";
import type { Database } from "../db";

export type NewUser = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl?: string | null;
  passwordHash?: string | null;
};

export function createUserRepository(db: Database) {
  return {
    async findById(id: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(eq(users.id, id));
      return row;
    },

    async findByEmail(email: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`);
      return row;
    },

    async create(user: NewUser): Promise<UserRow> {
      const [row] = await db.insert(users).values({ ...user, email: user.email.toLowerCase() }).returning();
      return row;
    },

    async updateProfile(id: string, profile: { firstName: string; lastName: string }): Promise<UserRow> {
      const [row] = await db.update(users).set({ ...profile, updatedAt: new Date() }).where(eq(users.id, id)).returning();
      return row;
    },

    async setPasswordHash(id: string, passwordHash: string): Promise<void> {
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
    },

    async setAdmin(id: string, isAdmin: boolean): Promise<UserRow | undefined> {
      const [row] = await db.update(users).set({ isAdmin, updatedAt: new Date() }).where(eq(users.id, id)).returning();
      return row;
    },

    async delete(id: string): Promise<void> {
      await db.delete(users).where(eq(users.id, id)); // links, clicks, QR settings and OAuth links cascade
    },

    async providersFor(userId: string): Promise<string[]> {
      const rows = await db
        .select({ provider: oauthAccounts.provider })
        .from(oauthAccounts)
        .where(eq(oauthAccounts.userId, userId));
      return rows.map((r) => r.provider);
    },

    async findByOAuth(provider: string, providerUserId: string): Promise<UserRow | undefined> {
      const [row] = await db
        .select({ user: users })
        .from(oauthAccounts)
        .innerJoin(users, eq(users.id, oauthAccounts.userId))
        .where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerUserId, providerUserId)));
      return row?.user;
    },

    async linkOAuth(userId: string, provider: string, providerUserId: string): Promise<void> {
      await db.insert(oauthAccounts).values({ userId, provider, providerUserId }).onConflictDoNothing();
    },

    async count(): Promise<number> {
      const [row] = await db.select({ n: count() }).from(users);
      return Number(row.n);
    },

    async list(limit: number, offset: number): Promise<{ rows: UserRow[]; total: number }> {
      const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
      return { rows, total: await this.count() };
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
