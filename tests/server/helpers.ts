import supertest from "supertest";
import { sql } from "drizzle-orm";
import { loadConfig } from "../../server/config";
import { createDatabase, runMigrations, type Database } from "../../server/db";
import { attachErrorHandler, createApp } from "../../server/http/app";
import type { RateLimits } from "../../server/http/middleware/security";

export const ORIGIN = "http://lf.test";
const url = process.env.TEST_DATABASE_URL;
export const hasDb = Boolean(url);

let shared: { db: Database; pool: import("pg").Pool } | undefined;

export async function database() {
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  if (!shared) {
    shared = createDatabase(url);
    await runMigrations(shared.db);
  }
  return shared;
}

/** Empty every table in the throwaway test database between tests. */
export async function resetDb() {
  const { db } = await database();
  await db.execute(sql.raw("TRUNCATE TABLE clicks, qr_settings, shortened_urls, oauth_accounts, users, sessions CASCADE"));
}

export async function closeDb() {
  await shared?.pool.end();
  shared = undefined;
}

export async function makeApp(opts: { rateLimits?: Partial<RateLimits>; env?: Record<string, string> } = {}) {
  const { db, pool } = await database();
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: url!,
    PUBLIC_BASE_URL: ORIGIN,
    SESSION_SECRET: "test-secret-test-secret-test-secret-123",
    ...opts.env,
  } as NodeJS.ProcessEnv);
  const app = createApp({
    config,
    db,
    pool,
    quiet: true,
    rateLimits: { auth: 1000, api: 10_000, redirect: 10_000, unlock: 1000, ...opts.rateLimits },
  });
  attachErrorHandler(app);
  return app;
}

/** A browser-like client: keeps cookies and sends our Origin on writes. */
export function client(app: Parameters<typeof supertest>[0]) {
  const agent = supertest.agent(app);
  return {
    agent,
    get: (path: string) => agent.get(path),
    post: (path: string, body?: object) => agent.post(path).set("Origin", ORIGIN).send(body ?? {}),
    patch: (path: string, body?: object) => agent.patch(path).set("Origin", ORIGIN).send(body ?? {}),
    put: (path: string, body?: object) => agent.put(path).set("Origin", ORIGIN).send(body ?? {}),
    delete: (path: string, body?: object) => agent.delete(path).set("Origin", ORIGIN).send(body ?? {}),
  };
}

export async function signUp(c: ReturnType<typeof client>, email = "alice@example.com") {
  const res = await c.post("/api/auth/register", {
    email,
    password: "correct horse battery",
    firstName: "Alice",
    lastName: "Example",
  });
  if (res.status !== 201) throw new Error(`sign-up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; email: string };
}
