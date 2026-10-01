import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit, { type Options } from "express-rate-limit";
import helmet from "helmet";
import type { Config } from "../../config";
import { AppError } from "../../errors";

export function securityHeaders(config: Config): RequestHandler {
  return helmet({
    contentSecurityPolicy: config.isProduction
      ? {
          useDefaults: false,
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
          },
        }
      : false, // Vite's dev server injects inline scripts and a WebSocket
    crossOriginEmbedderPolicy: false, // avatars are served by Google/GitHub
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: config.isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  });
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence: state-changing requests must come from our own origin.
 * Browsers always send Origin on cross-site POST/PUT/PATCH/DELETE, and pages
 * can't forge it. Requests without Origin or Referer are rejected outright.
 */
export function requireSameOrigin(config: Config): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    let origin = req.get("origin");
    if (!origin) {
      try {
        origin = new URL(req.get("referer") ?? "").origin;
      } catch {
        origin = undefined;
      }
    }
    if (origin !== config.publicOrigin) {
      return next(new AppError(403, "BAD_ORIGIN", "Request blocked: cross-site requests aren't allowed"));
    }
    next();
  };
}

export type RateLimits = { auth: number; api: number; redirect: number; unlock: number };
export const DEFAULT_RATE_LIMITS: RateLimits = { auth: 10, api: 300, redirect: 120, unlock: 10 };

function limiter(limit: number, windowMs: number, extra: Partial<Options> = {}): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req: Request, res: Response) =>
      res.status(429).json({ message: "Too many requests. Please slow down and try again shortly.", code: "RATE_LIMITED" }),
    ...extra,
  });
}

export function rateLimiters(limits: RateLimits) {
  return {
    auth: limiter(limits.auth, 15 * 60_000, { skipSuccessfulRequests: true }), // failed sign-ins / sign-ups
    api: limiter(limits.api, 15 * 60_000),
    redirect: limiter(limits.redirect, 60_000),
    unlock: limiter(limits.unlock, 15 * 60_000),
  };
}

/** Minimal access log: never bodies, query strings, cookies or IPs. */
export function requestLog(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      if (!req.path.startsWith("/api")) return;
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(0)}ms`);
    });
    next();
  };
}
