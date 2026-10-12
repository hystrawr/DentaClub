/**
 * API client — a thin fetch wrapper around the Express backend.
 *
 * Adapted from DentalOS's `lib/api/client.ts`, minus the staff/patient tokens
 * and tenant subdomains (this project has neither). What it keeps is the error
 * contract every screen relies on:
 *
 *  - a field-level failure (400 from validation, or 422 with `errors`) throws a
 *    `ValidationError` whose `errors` map can be painted onto the form;
 *  - anything else that is not 2xx throws an `ApiError` carrying the server's
 *    own message, so the screen can say what actually went wrong.
 */

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** The parsed response body, for callers that need more than the message (e.g. a 409's conflicting appointment). */
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ValidationError extends ApiError {
  constructor(
    public readonly errors: Record<string, string[]>,
    message = "Validation failed",
    body?: unknown,
  ) {
    super(422, message, body);
    this.name = "ValidationError";
  }
}

interface ErrorBody {
  error?: string;
  errors?: Record<string, string[]>;
  /** zod's issue list, sent with a 400. */
  issues?: Array<{ path: Array<string | number>; message: string }>;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      // Send the sign-in cookie (set by the API on this same host).
      credentials: "include",
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Is the backend running on port 4000?");
  }

  // Signed out, or the sign-in expired: go to the sign-in page, then come back.
  // A full page load on purpose — it also drops every patient record this tab
  // was holding in memory.
  if (res.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined") {
    const here = window.location.pathname + window.location.search;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
    window.location.assign(`/login?next=${encodeURIComponent(here)}`);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;

  if (res.ok) return data as T;

  const err = (data ?? {}) as ErrorBody;

  if (err.errors) {
    throw new ValidationError(err.errors, err.error ?? "Validation failed", data);
  }
  if (err.issues?.length) {
    const errors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      (errors[key] ??= []).push(issue.message);
    }
    throw new ValidationError(errors, err.error ?? "Invalid input", data);
  }

  throw new ApiError(res.status, err.error ?? `Request failed (${res.status})`, data);
}

export const get = <T>(path: string) => request<T>("GET", path);
export const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {});
export const patch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {});
export const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {});
export const del = <T>(path: string, body?: unknown) => request<T>("DELETE", path, body);

/** Every message in an error, for showing under a form. */
export function errorMessages(error: unknown): string[] {
  if (!error) return [];
  if (error instanceof ValidationError) return Object.values(error.errors).flat();
  return [error instanceof Error ? error.message : "This could not be saved."];
}
