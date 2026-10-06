/**
 * The base64 of `{"iv":` — the first six bytes of every intake token.
 *
 * A token is an encrypt-then-MAC envelope: base64 of a JSON object whose keys are
 * written in a fixed order, `iv` first (`apps/api/src/intake/intake-crypt.ts`
 * holds that order deliberately). The first six bytes of that JSON are therefore
 * always `{"iv":`, whatever the field lengths, and base64 encodes each three
 * bytes independently — so the first eight characters are always these.
 */
const ENVELOPE_PREFIX = 'eyJpdiI6'

/** Standard base64, including padding. Tokens never contain anything else. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

/**
 * Recover the intake token from a URL path segment, or null if the segment is
 * not one.
 *
 * Two separate problems, and they have to be solved together.
 *
 * **The segment arrives percent-encoded.** A token is base64, so roughly two
 * in three end in `=` padding, and Next.js hands that to the page as `%3D`
 * rather than `=`. The page passed the raw value straight to
 * `GET /api/patient/intake/{token}`, so the API got a token it could not
 * decrypt and answered "Invalid intake token" — meaning every padded link was
 * already dead, and looked to the patient exactly like an expired one. That is
 * why this returns the decoded token rather than a boolean: the caller needs
 * the repaired value, not just permission to proceed.
 *
 * **The route matches everything.** `app/(intake)/[token]` sits at the root of
 * the URL space — route groups add no path segment — so any single-segment
 * path renders the patient portal. /pateints reported a missing intake link
 * instead of 404, and the app had no 404 anywhere.
 *
 * Validity is not decided here. This says the segment is shaped like a token;
 * the API says whether it is live, and the page still renders its own message
 * when the API refuses.
 */
export function decodeIntakeToken(segment: string): string | null {
  let token: string
  try {
    token = decodeURIComponent(segment)
  } catch {
    // Malformed percent-escapes: not something we minted.
    return null
  }

  if (token.length < 64) return null
  if (!token.startsWith(ENVELOPE_PREFIX)) return null
  if (!BASE64.test(token)) return null

  return token
}
