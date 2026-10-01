import { Router } from "express";
import { z } from "zod";
import { listQuerySchema, type SystemStats } from "@shared/api";
import { badRequest, notFound } from "../../errors";
import type { ClickRepository } from "../../repositories/clickRepository";
import type { LinkRepository } from "../../repositories/linkRepository";
import type { UserRepository } from "../../repositories/userRepository";
import type { AnalyticsService } from "../../services/analyticsService";
import type { AuthService } from "../../services/authService";
import { idParam, type LinkService } from "../../services/linkService";

export function adminRoutes(deps: {
  users: UserRepository;
  linksRepo: LinkRepository;
  clicks: ClickRepository;
  links: LinkService;
  auth: AuthService;
  analytics: AnalyticsService;
}) {
  const router = Router();

  router.get("/stats", async (_req, res, next) => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000);
      const [totalUsers, linkCounts, totalClicks, last7] = await Promise.all([
        deps.users.count(),
        deps.linksRepo.countAll(),
        deps.clicks.total({}),
        deps.clicks.daily({ since: weekAgo }),
      ]);
      const stats: SystemStats = {
        totalUsers,
        totalLinks: linkCounts.total,
        totalClicks,
        clicksLast7Days: last7.reduce((sum, d) => sum + d.clicks, 0),
      };
      res.json({ ...stats, analytics: await deps.analytics.summary({ days: 30 }) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/links", async (req, res, next) => {
    try {
      const { page, limit } = listQuerySchema.parse(req.query);
      const { rows, total } = await deps.linksRepo.listAll(limit, (page - 1) * limit);
      res.json({ items: rows.map(deps.links.toDto), page, limit, total });
    } catch (err) {
      next(err);
    }
  });

  // Moderation: admins can disable/enable any link, but not edit or delete it.
  router.patch("/links/:id", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      const { isActive } = z.object({ isActive: z.boolean() }).strict().parse(req.body);
      const row = await deps.linksRepo.setActive(id, isActive);
      if (!row) throw notFound("Link");
      res.json({ id: row.id, isActive: row.isActive });
    } catch (err) {
      next(err);
    }
  });

  router.get("/users", async (req, res, next) => {
    try {
      const { page, limit } = listQuerySchema.parse(req.query);
      const { rows, total } = await deps.users.list(limit, (page - 1) * limit);
      res.json({ items: await Promise.all(rows.map(deps.auth.toPublic)), page, limit, total });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/users/:id", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      const { isAdmin } = z.object({ isAdmin: z.boolean() }).strict().parse(req.body);
      if (id === req.currentUser!.id && !isAdmin) {
        throw badRequest("SELF_DEMOTION", "You can't remove your own admin access");
      }
      const user = await deps.users.setAdmin(id, isAdmin);
      if (!user) throw notFound("User");
      res.json(await deps.auth.toPublic(user));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
