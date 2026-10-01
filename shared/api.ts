/**
 * API contract shared by client and server: request validation (zod) and
 * response shapes. The server validates every request body with these
 * schemas; nothing from the client is trusted without passing through one.
 */
import { z } from "zod";

// Paths a short code may never use: app pages, API, static assets.
export const RESERVED_ALIASES = new Set([
  "api", "admin", "analytics", "assets", "docs", "favicon.ico", "health", "l", "login", "logout",
  "privacy", "profile", "qr-codes", "register", "robots.txt", "signin", "signup", "src", "static",
  "support", "terms", "unlock", "well-known", ".well-known",
]);

export const ALIAS_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;
export const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);
const name = z
  .string()
  .trim()
  .min(1, "Required")
  .max(100)
  .regex(/^[^<>"'`{}\\]*$/, "Contains characters that aren't allowed");
const password = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters");

export const registerSchema = z.object({ email, password, firstName: name, lastName: name });
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
export const updateProfileSchema = z.object({ firstName: name, lastName: name });
export const changePasswordSchema = z.object({
  currentPassword: z.string().max(128).optional(),
  newPassword: password,
});
export const deleteAccountSchema = z.object({ confirm: z.literal("DELETE") });

export const httpUrl = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Enter a full http:// or https:// URL without embedded credentials");

const alias = z
  .string()
  .trim()
  .regex(ALIAS_PATTERN, "3–32 letters, numbers, - or _ (must start with a letter or number)")
  .refine((a) => !RESERVED_ALIASES.has(a.toLowerCase()), "This alias is reserved");

const futureDate = z.coerce
  .date()
  .refine((d) => d.getTime() > Date.now(), "Expiry must be in the future");

export const createLinkSchema = z.object({
  originalUrl: httpUrl,
  customAlias: alias.optional().or(z.literal("").transform(() => undefined)),
  title: z.string().trim().max(200).optional(),
  expiresAt: futureDate.optional().or(z.literal("").transform(() => undefined)),
  maxClicks: z.coerce.number().int().min(1).max(10_000_000).optional(),
  password: z.string().min(4, "Use at least 4 characters").max(128).optional().or(z.literal("").transform(() => undefined)),
});

export const updateLinkSchema = z
  .object({
    originalUrl: httpUrl,
    title: z.string().trim().max(200).nullable(),
    expiresAt: futureDate.nullable(),
    maxClicks: z.coerce.number().int().min(1).max(10_000_000).nullable(),
    isActive: z.boolean(),
    password: z.string().min(4).max(128),
    removePassword: z.literal(true),
  })
  .partial()
  .strict(); // unknown keys (userId, shortCode, …) are rejected, not ignored

export const qrSettingsSchema = z.object({
  size: z.coerce.number().int().min(128).max(1024).default(512),
  darkColor: z.string().regex(COLOR_PATTERN).default("#000000"),
  lightColor: z.string().regex(COLOR_PATTERN).default("#ffffff"),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).default("M"),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});

export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const unlockSchema = z.object({ password: z.string().min(1).max(128) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
// Over JSON, dates travel as ISO strings (the server coerces them).
export type CreateLinkInput = Omit<z.input<typeof createLinkSchema>, "expiresAt"> & { expiresAt?: string };
export type UpdateLinkInput = Omit<z.input<typeof updateLinkSchema>, "expiresAt"> & { expiresAt?: string | null };
export type QrSettingsInput = z.input<typeof qrSettingsSchema>;

// ---- response shapes --------------------------------------------------------

export type PublicUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAdmin: boolean;
  hasPassword: boolean;
  providers: string[];
  createdAt: string;
};

export type Link = {
  id: string;
  shortCode: string;
  shortUrl: string;
  originalUrl: string;
  title: string | null;
  isCustomAlias: boolean;
  hasPassword: boolean;
  expiresAt: string | null;
  maxClicks: number | null;
  isActive: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; email: string };
};

export type Paginated<T> = { items: T[]; page: number; limit: number; total: number };

export type Breakdown = { label: string; clicks: number; percentage: number };

export type AnalyticsSummary = {
  days: number;
  totalLinks: number;
  activeLinks: number;
  totalClicks: number;
  clicksInPeriod: number;
  dailyClicks: Array<{ date: string; clicks: number }>;
  countries: Array<Breakdown & { code: string }>;
  devices: Breakdown[];
  browsers: Breakdown[];
  operatingSystems: Breakdown[];
  referrers: Breakdown[];
  topLinks: Array<{ id: string; shortCode: string; title: string | null; clicks: number }>;
  recentClicks: RecentClick[];
};

export type RecentClick = {
  shortCode: string;
  country: string | null;
  device: string | null;
  browser: string | null;
  referrerHost: string | null;
  clickedAt: string;
};

export type SystemStats = {
  totalUsers: number;
  totalLinks: number;
  totalClicks: number;
  clicksLast7Days: number;
};

export type AuthProviders = { local: true; google: boolean; github: boolean; apple: boolean };

export type ApiError = { message: string; code: string; fields?: Record<string, string> };
