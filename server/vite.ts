import express, { type Express } from "express";
import fs from "node:fs";
import type { Server } from "node:http";
import path from "node:path";

/** Development: Vite middleware with HMR, serving client/index.html for SPA routes. */
export async function setupVite(app: Express, server: Server) {
  // Non-literal specifiers keep the bundler from pulling dev-only packages
  // (vite, @vitejs/plugin-react) into the production build.
  const viteModule = "vite";
  const configModule = "../vite.config";
  const { createServer } = (await import(viteModule)) as typeof import("vite");
  const viteConfig = ((await import(configModule)) as { default: import("vite").UserConfig }).default;
  const vite = await createServer({
    ...viteConfig,
    configFile: false,
    server: { middlewareMode: true, hmr: { server }, allowedHosts: ["localhost", "127.0.0.1"] },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    try {
      const template = await fs.promises.readFile(path.resolve(import.meta.dirname, "..", "client", "index.html"), "utf-8");
      res.status(200).type("html").end(await vite.transformIndexHtml(req.originalUrl, template));
    } catch (err) {
      vite.ssrFixStacktrace(err as Error);
      next(err);
    }
  });
}

/** Production: hashed assets cached for a year, index.html never cached, SPA fallback. */
export function serveStatic(app: Express) {
  const dist = path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(dist)) throw new Error(`Client build not found at ${dist}. Run "npm run build" first.`);
  app.use("/assets", express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y", index: false }));
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.use((req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(dist, "index.html"));
  });
}
