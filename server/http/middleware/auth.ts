import type { NextFunction, Request, Response } from "express";
import type { UserRow } from "@shared/schema";
import { forbidden, unauthorized } from "../../errors";
import type { UserRepository } from "../../repositories/userRepository";

declare module "express-session" {
  interface SessionData {
    userId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: UserRow;
    }
  }
}

/**
 * Re-load the signed-in user from the database on every request. A deleted
 * account or a revoked admin flag takes effect immediately; nothing about
 * the user's privileges is trusted from the session itself.
 */
export function loadUser(users: UserRepository) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const id = req.session?.userId;
      if (id) {
        const user = await users.findById(id);
        if (user) req.currentUser = user;
        else delete req.session.userId;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  if (!req.currentUser) return next(unauthorized());
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.currentUser) return next(unauthorized());
  if (!req.currentUser.isAdmin) return next(forbidden("Admin access required"));
  next();
}

/** New session id on sign-in (prevents session fixation). */
export function establishSession(req: Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) =>
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    }),
  );
}
