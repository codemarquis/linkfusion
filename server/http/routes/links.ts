import { Router } from "express";
import { z } from "zod";
import { analyticsQuerySchema, listQuerySchema, qrSettingsSchema } from "@shared/api";
import type { QrRepository, QrStyle } from "../../repositories/qrRepository";
import type { AnalyticsService } from "../../services/analyticsService";
import { idParam, type LinkService } from "../../services/linkService";
import { DEFAULT_QR_STYLE, renderQr } from "../../services/qrService";

const qrQuery = z.object({
  format: z.enum(["png", "svg"]).default("png"),
  download: z.enum(["1", "0"]).optional(),
});

export function linkRoutes(deps: { links: LinkService; qr: QrRepository; analytics: AnalyticsService }) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      res.json(await deps.links.list(req.currentUser!.id, listQuerySchema.parse(req.query)));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      res.status(201).json(await deps.links.create(req.currentUser!.id, req.body));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      res.json(deps.links.toDto(await deps.links.ownedOr404(req.currentUser!.id, id)));
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      res.json(await deps.links.update(req.currentUser!.id, id, req.body));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      await deps.links.remove(req.currentUser!.id, id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/analytics", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      await deps.links.ownedOr404(req.currentUser!.id, id);
      const { days } = analyticsQuerySchema.parse(req.query);
      res.json(await deps.analytics.summary({ userId: req.currentUser!.id, linkId: id, days }));
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/clicks.csv", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      const link = await deps.links.ownedOr404(req.currentUser!.id, id);
      const { days } = analyticsQuerySchema.parse(req.query);
      const csv = await deps.analytics.csv({ userId: req.currentUser!.id, linkId: id, days });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="clicks-${link.shortCode}.csv"`);
      res.send(csv);
    } catch (err) {
      next(err);
    }
  });

  // ---- QR codes: rendered on demand from saved (or default) styling ----------
  router.get("/:id/qr/settings", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      await deps.links.ownedOr404(req.currentUser!.id, id);
      const saved = await deps.qr.get(id);
      res.json({ ...DEFAULT_QR_STYLE, ...(saved ?? {}), customized: Boolean(saved) });
    } catch (err) {
      next(err);
    }
  });

  router.put("/:id/qr/settings", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      await deps.links.ownedOr404(req.currentUser!.id, id);
      const style = qrSettingsSchema.parse(req.body) as QrStyle;
      res.json({ ...(await deps.qr.upsert(id, style)), customized: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id/qr/settings", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      await deps.links.ownedOr404(req.currentUser!.id, id);
      await deps.qr.delete(id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id/qr", async (req, res, next) => {
    try {
      const { id } = idParam.parse(req.params);
      const link = await deps.links.ownedOr404(req.currentUser!.id, id);
      const { format, download } = qrQuery.parse(req.query);
      const style = (await deps.qr.get(id)) ?? DEFAULT_QR_STYLE;
      const image = await renderQr(deps.links.toDto(link).shortUrl, style, format);
      res.setHeader("Content-Type", format === "svg" ? "image/svg+xml" : "image/png");
      res.setHeader("Cache-Control", "private, no-cache");
      if (format === "svg") res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
      if (download === "1") res.setHeader("Content-Disposition", `attachment; filename="qr-${link.shortCode}.${format}"`);
      res.send(image);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
