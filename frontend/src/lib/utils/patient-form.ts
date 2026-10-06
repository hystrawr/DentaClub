/**
 * What an edit form actually sends (from DentalOS).
 *
 * The update is partial, so an absent key is a field left alone. That makes
 * three states expressible, and a patient record needs all three:
 *
 *  - **absent** — not touched;
 *  - **`null`** — cleared. A receptionist who deletes a wrong email is saying
 *    "this is not their email", which is a real edit and must be written;
 *  - **a value** — changed.
 *
 * Folding "cleared" into "not touched" — which any truthiness check does —
 * means a wrong phone number can be deleted, saved, and still be there.
 */
export function changedFields(
  original: Record<string, string>,
  current: Record<string, string>,
): Record<string, string | null> {
  const payload: Record<string, string | null> = {};

  for (const key of Object.keys(original)) {
    const before = (original[key] ?? "").trim();
    const after = (current[key] ?? "").trim();
    if (before === after) continue;
    payload[key] = after === "" ? null : after;
  }

  return payload;
}
