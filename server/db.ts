/** Database connection: one pg pool per process, wrapped by Drizzle. */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import pg from "pg";
import * as schema from "@shared/schema";

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(databaseUrl: string): { db: Database; pool: pg.Pool } {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
  });
  pool.on("error", (err) => console.error("[db] idle client error:", err.message));
  return { db: drizzle(pool, { schema }), pool };
}

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: path.resolve(import.meta.dirname, "..", "migrations") });
}
