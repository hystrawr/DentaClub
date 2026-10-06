/**
 * Throw one of these from a route or service to send a specific status code.
 * The error handler in index.ts turns it into `{ error: message, errors?, ...extra }`.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Optional per-field messages, e.g. `{ "responses.allergies": ["…required."] }`. */
    readonly errors?: Record<string, string[]>,
    /** Optional extra top-level fields, e.g. the appointment a booking collided with. */
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (message = "Not found") => new HttpError(404, message);

/** 422 — the request is well-formed but breaks a clinical rule. */
export const ruleViolation = (message: string, errors?: Record<string, string[]>) =>
  new HttpError(422, message, errors);

/** 422 naming the one field whose referenced record does not exist. */
export const invalidField = (field: string) =>
  ruleViolation("Validation failed.", {
    [field]: [`The selected ${field.replace(/_/g, " ")} is invalid.`],
  });
