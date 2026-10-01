/** Apply database migrations:  npm run db:migrate */
import { loadConfig } from "../config";
import { createDatabase, runMigrations } from "../db";

const config = loadConfig();
const { db, pool } = createDatabase(config.databaseUrl);
await runMigrations(db);
await pool.end();
console.log("Migrations applied.");
