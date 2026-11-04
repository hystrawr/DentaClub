import { prisma } from "../../lib/prisma.js";
import { clockInManila, manilaDayEnd, manilaDayStart, manilaInstant, timeString } from "../../lib/dates.js";
import { LUNCH_END, LUNCH_START, RELEASES_SLOT } from "./appointments.js";

// The free times shown when booking.

/** One free time, `HH:mm` to `HH:mm` on the Manila clock. */
export interface Slot {
  start: string;
  end: string;
}

/**
 * Free slots for one dentist on one date: their working windows for that
 * weekday, in `slotMinutes` steps, minus any step that overlaps an appointment.
 * All times are Manila wall-clock.
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
  const lunchStart = manilaInstant(day, LUNCH_START).getTime();
  const lunchEnd = manilaInstant(day, LUNCH_END).getTime();

  for (const rule of rules) {
    const windowStart = manilaInstant(day, timeString(rule.startTime) ?? "00:00:00");
    const windowEnd = manilaInstant(day, timeString(rule.endTime) ?? "00:00:00");

    for (let start = windowStart.getTime(); start + step <= windowEnd.getTime(); start += step) {
      const end = start + step;
      const overlaps = booked.some((a) => a.scheduledStart.getTime() < end && a.scheduledEnd.getTime() > start);
      // Booking refuses the lunch break, so it is never offered either.
      const duringLunch = start < lunchEnd && end > lunchStart;
      if (!overlaps && !duringLunch) slots.push({ start: clockInManila(new Date(start)), end: clockInManila(new Date(end)) });
    }
  }

  return slots;
}
