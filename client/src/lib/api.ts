/**
 * The only way the client talks to the server: same-origin requests with the
 * session cookie, JSON in and out, and typed errors (including per-field
 * validation messages) instead of string parsing.
 */
import type { ApiError as ApiErrorBody } from "@shared/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? { Accept: "application/json" } : { "Content-Type": "application/json", Accept: "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (ApiErrorBody & T) | null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.code ?? "HTTP_ERROR", data?.message ?? res.statusText, data?.fields);
  }
  return data as T;
}

export const isUnauthorized = (err: unknown) => err instanceof ApiError && err.status === 401;
