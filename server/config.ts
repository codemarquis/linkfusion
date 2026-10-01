/**
 * Configuration, validated once at startup. The process refuses to start
 * with missing or weak settings instead of falling back to insecure defaults.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url().refine((u) => /^postgres(ql)?:\/\//.test(u), "must be a postgres:// URL"),
    SESSION_SECRET: z.string().optional(),
    PUBLIC_BASE_URL: z.string().url().optional(),
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    MIGRATE_ON_START: bool.default("true"),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production") {
      if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
        ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "required in production (32+ random characters)" });
      }
      if (!env.PUBLIC_BASE_URL?.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["PUBLIC_BASE_URL"], message: "required in production and must use https://" });
      }
    }
  });

export type Config = {
  env: "development" | "test" | "production";
  isProduction: boolean;
  host: string;
  port: number;
  databaseUrl: string;
  sessionSecret: string;
  publicBaseUrl: string;
  publicOrigin: string;
  trustProxy: number;
  migrateOnStart: boolean;
  google?: { clientId: string; clientSecret: string };
  github?: { clientId: string; clientSecret: string };
};

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid configuration:\n${problems}`);
  }
  const env = parsed.data;
  const publicBaseUrl = (env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`).replace(/\/+$/, "");
  let sessionSecret = env.SESSION_SECRET;
  if (!sessionSecret) {
    // Development/test only (production is rejected above): a random secret per
    // process, so there is never a guessable built-in default.
    sessionSecret = randomBytes(32).toString("hex");
  }
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    host: env.HOST,
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    sessionSecret,
    publicBaseUrl,
    publicOrigin: new URL(publicBaseUrl).origin,
    trustProxy: env.TRUST_PROXY,
    migrateOnStart: env.MIGRATE_ON_START,
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
    github:
      env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
        ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
        : undefined,
  };
}
