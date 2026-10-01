import { Router } from "express";
import { analyticsQuerySchema } from "@shared/api";
import type { AnalyticsService } from "../../services/analyticsService";

export function analyticsRoutes(deps: { analytics: AnalyticsService }) {
  const router = Router();

  router.get("/summary", async (req, res, next) => {
    try {
      const { days } = analyticsQuerySchema.parse(req.query);
      res.json(await deps.analytics.summary({ userId: req.currentUser!.id, days }));
    } catch (err) {
      next(err);
    }
  });

  router.get("/export.csv", async (req, res, next) => {
    try {
      const { days } = analyticsQuerySchema.parse(req.query);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="linkfusion-clicks-${days}d.csv"`);
      res.send(await deps.analytics.csv({ userId: req.currentUser!.id, days }));
    } catch (err) {
      next(err);
    }
  });

  return router;
}
