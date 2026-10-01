import { createServer } from "node:http";
import { loadConfig } from "./config";
import { createDatabase, runMigrations } from "./db";
import { attachErrorHandler, createApp } from "./http/app";

const config = loadConfig();
const { db, pool } = createDatabase(config.databaseUrl);

if (config.migrateOnStart) await runMigrations(db);

const app = createApp({ config, db, pool });
const server = createServer(app);

// SERVE_STATIC=true serves the built client without Vite (local Docker; see docker-compose.yml).
if (config.isProduction || process.env.SERVE_STATIC === "true") {
  const { serveStatic } = await import("./vite");
  serveStatic(app);
} else {
  const { setupVite } = await import("./vite");
  await setupVite(app, server);
}
attachErrorHandler(app);

server.listen(config.port, config.host, () => {
  console.log(`LinkFusion listening on http://${config.host}:${config.port} (${config.env}), public URL ${config.publicBaseUrl}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`);
  server.close(() => pool.end().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
