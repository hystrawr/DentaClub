import { createHash, randomUUID } from "node:crypto";
import type { IntakeSubmission } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../lib/http-error.js";
import { isoOffset } from "../../lib/dates.js";
import { decodeAppKey, decryptString, encryptString } from "../../lib/intake-crypt.js";

// Ported from DentalOS apps/api/src/intake/intake-link.service.ts.
// Removed: the tenant check (there is one clinic) and the access audit trail
// (there is no audits table). Everything else is unchanged.

/** The floor, and what a link with no appointment behind it still gets. */
const TOKEN_TTL_HOURS = 24;

/**
 * The ceiling. A link is a bearer credential sitting in an SMS thread on a phone
 * that gets lost, sold and handed to children; ninety days is already generous
 * for something with no second factor.
 */
const TOKEN_MAX_TTL_DAYS = 90;

/**
 * When a link minted now should expire: `max(24h, appointmentStart + 24h)`, never
 * more than 90 days out.
 *
 * A fixed 24 hours would be a quiet failure: a clinic confirming a visit three
 * weeks out would send a link that was dead the next morning. The 24 hours of
 * grace after the visit is for the patient who fills the form in the waiting
 * room. The result goes inside the encrypted payload, so only the server can
 * extend it.
 */
function expiresAtFor(appointmentStart: Date | null, now: Date = new Date()): Date {
  const floor = now.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000;
  const cap = now.getTime() + TOKEN_MAX_TTL_DAYS * 24 * 60 * 60 * 1000;

  const wanted =
    appointmentStart && !Number.isNaN(appointmentStart.getTime())
      ? appointmentStart.getTime() + TOKEN_TTL_HOURS * 60 * 60 * 1000
      : floor;

  return new Date(Math.min(Math.max(wanted, floor), cap));
}

interface TokenPayload {
  patient_id: string;
  packet_id: string;
  appointment_id: string | null;
  expires_at: string;
  jti: string;
}

/**
 * Tokenised intake links.
 *
 * The token is an encrypted payload the patient carries in a URL; the server
 * stores only its SHA-256. A stolen database gives an attacker hashes, not
 * working links, and a token cannot be looked up by anything except itself.
 *
 * Three independent checks have to pass before a link opens:
 *
 *  1. **The token decrypts and its MAC verifies** — it was minted under this
 *     server's APP_KEY, and nothing in it has been edited.
 *  2. **It has not expired** — the expiry is inside the encrypted payload, so it
 *     cannot be extended by the holder.
 *  3. **A submission still matches its hash, and is not already completed** — a
 *     link is single-use, so a forwarded message cannot re-open a signed form.
 */
const key = () => decodeAppKey(process.env.APP_KEY ?? "");

export async function generate(
  patientId: string,
  packetId: string,
  appointmentId: string | null = null,
  appointmentStart: Date | null = null,
) {
  let start = appointmentStart;
  if (!start && appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { scheduledStart: true },
    });
    start = appointment?.scheduledStart ?? null;
  }

  const expiresAt = expiresAtFor(start);

  const payload: TokenPayload = {
    patient_id: patientId,
    packet_id: packetId,
    appointment_id: appointmentId,
    expires_at: isoOffset(expiresAt)!,
    // A nonce, so two links minted for the same patient and packet in the same
    // second are still different tokens with different hashes.
    jti: randomUUID(),
  };

  const token = encryptString(JSON.stringify(payload), key());

  const submission = await prisma.intakeSubmission.create({
    data: { patientId, packetId, appointmentId, tokenHash: hashToken(token) },
  });

  return { token, expiresAt, submission };
}

/**
 * Resolve a token to its submission, or refuse.
 *
 * Every failure is a 401 with a distinct message — the front desk needs to know
 * whether to re-send a link or explain that the form is already done — and none
 * of them reveal anything the holder of the token does not already have.
 */
export async function validate(token: string): Promise<IntakeSubmission> {
  let payload: TokenPayload;
  try {
    payload = JSON.parse(decryptString(token, key()));
  } catch {
    throw new HttpError(401, "Invalid intake token.");
  }

  if (new Date(payload.expires_at).getTime() <= Date.now()) {
    throw new HttpError(401, "Intake token has expired.");
  }

  const submission = await prisma.intakeSubmission.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!submission) throw new HttpError(401, "Intake token not found.");
  if (submission.completedAt) {
    throw new HttpError(401, "This intake link has already been completed.");
  }

  return submission;
}

/** The status check reads by hash alone — it works after completion too. */
export function byTokenHash(token: string): Promise<IntakeSubmission | null> {
  return prisma.intakeSubmission.findUnique({ where: { tokenHash: hashToken(token) } });
}

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
