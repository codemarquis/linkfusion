/**
 * Fill a development database with a demo account, links and synthetic clicks:
 *   npm run seed:demo                     # demo@linkfusion.local
 *   npm run seed:demo -- you@example.com  # any email you like
 * The password is random and printed once. Refuses to touch a production
 * database unless ALLOW_DEMO_SEED=true is set explicitly.
 */
import { loadConfig } from "../config";
import { createDatabase, runMigrations } from "../db";
import { seedDemo } from "../services/demoData";

const config = loadConfig();
if (config.isProduction && process.env.ALLOW_DEMO_SEED !== "true") {
  console.error("Refusing to seed demo data into production. Set ALLOW_DEMO_SEED=true if you really mean it.");
  process.exit(1);
}

const email = process.argv[2]?.trim();
if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run seed:demo -- [demo@example.com]");
  process.exit(1);
}

const { db, pool } = createDatabase(config.databaseUrl);
await runMigrations(db);
const result = await seedDemo(db, { email });
console.log(
  `Demo account ready: ${result.links} links, ${result.clicks} clicks over the last 90 days.\n` +
    `  Email:    ${result.email}\n  Password: ${result.password}\n` +
    `Run it again to reset the demo. Delete it any time from Profile → Delete account.`,
);
await pool.end();
