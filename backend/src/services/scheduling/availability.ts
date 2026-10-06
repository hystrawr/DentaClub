import { prisma } from "../../lib/prisma.js";
import { clockInManila, manilaDayEnd, manilaDayStart, manilaInstant, timeString } from "../../lib/dates.js";
import { RELEASES_SLOT } from "./appointments.js";

// Ported from DentalOS apps/api/src/scheduling/availability.service.ts —
// `getAvailableSlots`, the staff slot picker. (`bookableSlots` and
// `pickProvider` belong to online booking, which was not ported.)

export interface Slot {
  start: string;
  end: string;
}

/**
 * Free slots for one provider on one date.
 *
 * The provider's weekly rules give the working windows for that weekday; the
 * windows are then walked in `slotMinutes` steps and any step overlapping a live
 * appointment is dropped. A window that does not divide evenly simply stops
 * short — the trailing remainder is not offered as a short slot.
 *
 * Everything here is Manila wall-clock: the weekday, the window boundaries, the
 * "same day" appointment lookup, and the `HH:mm` strings that come back.
 */
export async function getAvailableSlots(providerProfileId: string, date: string, slotMinutes = 15): Promise<Slot[]> {
  const day = date.slice(0, 10);
  // 0 = Sunday … 6 = Saturday, read off the bare calendar date in UTC so the
  // answer is the weekday the clinic sees, whatever the server's timezone.
  const dayOfWeek = new Date(`${day}T00:00:00Z`).getUTCDay();

  const rules = await prisma.providerAvailability.findMany({
    where: { providerProfileId, dayOfWeek },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  if (rules.length === 0) return [];

  const booked = await prisma.appointment.findMany({
    where: {
      providerProfileId,
      status: { notIn: RELEASES_SLOT },
      scheduledStart: { gte: manilaDayStart(day), lt: manilaDayEnd(day) },
    },
    select: { scheduledStart: true, scheduledEnd: true },
  });

  const slots: Slot[] = [];
  const step = slotMinutes * 60_000;

  for (const rule of rules) {
    const windowStart = manilaInstant(day, timeString(rule.startTime) ?? "00:00:00");
    const windowEnd = manilaInstant(day, timeString(rule.endTime) ?? "00:00:00");

    for (let start = windowStart.getTime(); start + step <= windowEnd.getTime(); start += step) {
      const end = start + step;
      const overlaps = booked.some((a) => a.scheduledStart.getTime() < end && a.scheduledEnd.getTime() > start);
      if (!overlaps) slots.push({ start: clockInManila(new Date(start)), end: clockInManila(new Date(end)) });
    }
  }

  return slots;
}
