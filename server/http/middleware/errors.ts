import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../../errors";

export function notFoundApi(req: Request, res: Response) {
  res.status(404).json({ message: "Not found", code: "NOT_FOUND" });
}

/** Clients get a safe message; details only go to the server log. Never re-throws. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".") || "body"] ??= issue.message;
    return res.status(400).json({ message: "Please check the highlighted fields", code: "VALIDATION_ERROR", fields });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code, ...(err.fields ? { fields: err.fields } : {}) });
  }
  const status = (err as { status?: number; type?: string }).status;
  if (status === 413) return res.status(413).json({ message: "Request is too large", code: "PAYLOAD_TOO_LARGE" });
  if ((err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json({ message: "Malformed JSON", code: "BAD_JSON" });
  }
  console.error(`[error] ${req.method} ${req.path}:`, err);
  res.status(500).json({ message: "Something went wrong. Please try again.", code: "INTERNAL" });
}
