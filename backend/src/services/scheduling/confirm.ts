import { prisma } from "../../lib/prisma.js";
import { isoOffset } from "../../lib/dates.js";
import * as appointments from "./appointments.js";
import * as links from "../intake/links.js";

// Ported from DentalOS BookingRequestService.confirmBookingRequest — the one
// door every confirmation goes through, so confirming from the calendar always
// does the same thing:
//
//   1. the double-booking check + status change (appointments.confirm), then
//   2. mint the patient's consent/intake link for the clinic's first active packet.
//
// DentalOS step 3 texts the link to the patient by SMS. There is no SMS here,
// so the link is returned instead, for the front desk to copy or show.

export interface IntakeLinkResult {
  generated: boolean;
  expires_at: string | null;
  url: string | null;
}

export async function confirmAppointment(appointmentId: string) {
  const appointment = await appointments.confirm(appointmentId);
  const intake = await mintIntakeLink(appointment);
  return { appointment, intake };
}

/**
 * A link for the first active packet, or an honest "no".
 *
 * The whole body is guarded: the confirmation has already succeeded, and must
 * not be undone by a failure minting the link afterwards.
 */
async function mintIntakeLink(appointment: { id: string; patientId: string | null }): Promise<IntakeLinkResult> {
  const none: IntakeLinkResult = { generated: false, expires_at: null, url: null };
  // Block time (lunch) has no patient to send a form to.
  if (!appointment.patientId) return none;

  try {
    const packet = await prisma.intakePacket.findFirst({
      where: { isActive: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true },
    });
    if (!packet) return none;

    const { token, expiresAt } = await links.generate(appointment.patientId, packet.id, appointment.id);
    const base = process.env.FRONTEND_URL ?? "http://localhost:3000";

    // The token is base64 and can contain `/` and `+`. Unencoded, a `/` splits
    // the path and the patient lands on a 404 with a link that looks fine.
    return {
      generated: true,
      expires_at: isoOffset(expiresAt),
      url: `${base}/intake/${encodeURIComponent(token)}`,
    };
  } catch (error) {
    console.error(`Intake link could not be minted for appointment ${appointment.id}:`, error);
    return none;
  }
}
