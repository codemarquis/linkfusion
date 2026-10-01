/** Errors that are safe to show to clients. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const unauthorized = () => new AppError(401, "UNAUTHORIZED", "Sign in to continue");
export const forbidden = (message = "You don't have access to this") => new AppError(403, "FORBIDDEN", message);
export const conflict = (code: string, message: string, fields?: Record<string, string>) =>
  new AppError(409, code, message, fields);
export const badRequest = (code: string, message: string, fields?: Record<string, string>) =>
  new AppError(400, code, message, fields);
