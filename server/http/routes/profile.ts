import { Router } from "express";
import { changePasswordSchema, deleteAccountSchema, updateProfileSchema } from "@shared/api";
import type { Config } from "../../config";
import type { UserRepository } from "../../repositories/userRepository";
import type { AuthService } from "../../services/authService";
import type { LinkService } from "../../services/linkService";

export function profileRoutes(deps: { config: Config; users: UserRepository; auth: AuthService; links: LinkService }) {
  const router = Router();

  // Only names can be changed here; email, isAdmin etc. are never taken from the body.
  router.patch("/", async (req, res, next) => {
    try {
      const user = await deps.users.updateProfile(req.currentUser!.id, updateProfileSchema.parse(req.body));
      res.json(await deps.auth.toPublic(user));
    } catch (err) {
      next(err);
    }
  });

  router.post("/password", async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
      await deps.auth.changePassword(req.currentUser!, currentPassword, newPassword);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // GDPR: everything we hold about the user, as JSON.
  router.get("/export", async (req, res, next) => {
    try {
      const user = req.currentUser!;
      const links = await deps.links.list(user.id, { page: 1, limit: 100_000 });
      res.setHeader("Content-Disposition", 'attachment; filename="linkfusion-export.json"');
      res.json({ exportedAt: new Date().toISOString(), profile: await deps.auth.toPublic(user), links: links.items });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/", async (req, res, next) => {
    try {
      deleteAccountSchema.parse(req.body);
      await deps.users.delete(req.currentUser!.id);
      req.session.destroy(() => {
        res.clearCookie(deps.config.isProduction ? "__Host-lf.sid" : "lf.sid", { path: "/" });
        res.status(204).end();
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
