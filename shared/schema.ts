/**
 * Database schema (Drizzle). Shared so the client can use the row types.
 *
 * Privacy by design: clicks never store the visitor's IP address, full
 * user agent or city. Only coarse, non-identifying attributes are kept.
 */
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// express-session store (connect-pg-simple)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (t) => [index("idx_sessions_expire").on(t.expire)],
);

export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    email: varchar("email", { length: 254 }).notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    profileImageUrl: varchar("profile_image_url", { length: 2048 }),
    passwordHash: varchar("password_hash"),
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_users_email").on(sql`lower(${t.email})`)],
);

// One row per external identity (Google, GitHub) linked to a user.
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    provider: varchar("provider", { length: 20 }).notNull(),
    providerUserId: varchar("provider_user_id", { length: 255 }).notNull(),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerUserId] }), index("idx_oauth_user").on(t.userId)],
);

export const shortenedUrls = pgTable(
  "shortened_urls",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    originalUrl: text("original_url").notNull(),
    shortCode: varchar("short_code", { length: 32 }).notNull(),
    isCustomAlias: boolean("is_custom_alias").notNull().default(false),
    title: varchar("title", { length: 200 }),
    passwordHash: varchar("password_hash"),
    expiresAt: timestamp("expires_at"),
    maxClicks: integer("max_clicks"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_urls_short_code").on(sql`lower(${t.shortCode})`),
    index("idx_urls_user_created").on(t.userId, t.createdAt),
  ],
);

export const clicks = pgTable(
  "clicks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    urlId: varchar("url_id")
      .notNull()
      .references(() => shortenedUrls.id, { onDelete: "cascade" }),
    country: varchar("country", { length: 2 }), // ISO 3166-1 alpha-2, resolved offline
    device: varchar("device", { length: 16 }),
    browser: varchar("browser", { length: 32 }),
    os: varchar("os", { length: 32 }),
    referrerHost: varchar("referrer_host", { length: 255 }), // host only, never the full referrer URL
    clickedAt: timestamp("clicked_at").notNull().defaultNow(),
  },
  (t) => [index("idx_clicks_url_time").on(t.urlId, t.clickedAt)],
);

// Per-link QR code styling. Images are rendered on demand, never stored.
export const qrSettings = pgTable("qr_settings", {
  urlId: varchar("url_id")
    .primaryKey()
    .references(() => shortenedUrls.id, { onDelete: "cascade" }),
  size: integer("size").notNull().default(512),
  darkColor: varchar("dark_color", { length: 7 }).notNull().default("#000000"),
  lightColor: varchar("light_color", { length: 7 }).notNull().default("#ffffff"),
  errorCorrection: varchar("error_correction", { length: 1 }).notNull().default("M"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  shortenedUrls: many(shortenedUrls),
  oauthAccounts: many(oauthAccounts),
}));

export const shortenedUrlsRelations = relations(shortenedUrls, ({ one, many }) => ({
  user: one(users, { fields: [shortenedUrls.userId], references: [users.id] }),
  clicks: many(clicks),
  qrSettings: one(qrSettings, { fields: [shortenedUrls.id], references: [qrSettings.urlId] }),
}));

export const clicksRelations = relations(clicks, ({ one }) => ({
  shortenedUrl: one(shortenedUrls, { fields: [clicks.urlId], references: [shortenedUrls.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type LinkRow = typeof shortenedUrls.$inferSelect;
export type ClickRow = typeof clicks.$inferSelect;
export type QrSettingsRow = typeof qrSettings.$inferSelect;
