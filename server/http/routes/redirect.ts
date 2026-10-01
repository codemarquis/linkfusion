/**
 * Public short-link handling: GET /:code redirects, password-protected links
 * get an unlock form, POST /:code/unlock checks the password (rate-limited).
 */
import { Router, type Request, type RequestHandler, type Response, urlencoded } from "express";
import { ALIAS_PATTERN, RESERVED_ALIASES, unlockSchema } from "@shared/api";
import type { LinkRow } from "@shared/schema";
import { clickFacts } from "../../services/clickContext";
import { unavailablePage, unlockPage } from "../../services/pages";
import type { RedirectService } from "../../services/redirectService";

const looksLikeCode = (code: string) => ALIAS_PATTERN.test(code) && !RESERVED_ALIASES.has(code.toLowerCase());

const STATUS: Record<string, number> = { not_found: 404, inactive: 410, expired: 410, limit_reached: 410 };

export function redirectRoutes(deps: {
  redirects: RedirectService;
  ownHost: string;
  redirectLimiter: RequestHandler;
  unlockLimiter: RequestHandler;
}) {
  const router = Router();

  const noStore = (res: Response) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
  };

  const go = (req: Request, res: Response, link: LinkRow, status: 302 | 303) => {
    if (req.method !== "HEAD") {
      deps.redirects.record(link, clickFacts({
        ip: req.ip,
        userAgent: req.get("user-agent"),
        referrer: req.get("referer"),
        ownHost: deps.ownHost,
      }));
    }
    noStore(res);
    res.redirect(status, link.originalUrl);
  };

  const html = (res: Response, status: number, body: string, allowExternalFormTarget = false) => {
    noStore(res);
    if (allowExternalFormTarget) {
      // The unlock form posts here and is then redirected to the destination site.
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http:; frame-ancestors 'none'; base-uri 'none'",
      );
    }
    res.status(status).type("html").send(body);
  };

  router.get("/:code", deps.redirectLimiter, async (req, res, next) => {
    const code = String(req.params.code);
    if (!looksLikeCode(code)) return next(); // app pages, assets, …
    try {
      const result = await deps.redirects.resolve(code);
      if (result.kind === "redirect") return go(req, res, result.link, 302);
      if (result.kind === "password") return html(res, 401, unlockPage(result.link.shortCode), true);
      html(res, STATUS[result.kind] ?? 404, unavailablePage(result.kind));
    } catch (err) {
      next(err);
    }
  });

  router.post("/:code/unlock", deps.unlockLimiter, urlencoded({ extended: false, limit: "2kb" }), async (req, res, next) => {
    const code = String(req.params.code);
    if (!looksLikeCode(code)) return next();
    try {
      const parsed = unlockSchema.safeParse(req.body);
      const result = await deps.redirects.unlock(code, parsed.success ? parsed.data.password : "");
      if (result.kind === "redirect") return go(req, res, result.link, 303);
      if (result.kind === "wrong_password") {
        return html(res, 401, unlockPage(result.link.shortCode, "Incorrect password. Try again."), true);
      }
      if (result.kind === "password") return html(res, 401, unlockPage(result.link.shortCode), true);
      html(res, STATUS[result.kind] ?? 404, unavailablePage(result.kind));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
