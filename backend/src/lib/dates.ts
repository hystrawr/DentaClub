/** Date helpers, ported from DentalOS. The clinic runs on Manila time (UTC+8). */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** `2026-10-04T09:30:00+08:00` — timestamps in Philippine time, as DentalOS sends them. */
export function isoOffset(date: Date | null | undefined): string | null {
  if (!date) return null;
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 19)}+08:00`;
}

/** `2026-10-04T01:30:00.000000Z` — UTC, the format DentalOS uses for raw models. */
export function isoUtc(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().replace(/\.(\d{3})Z$/, ".$1000Z");
}

/**
 * `YYYY-MM-DD` from a `@db.Date` column. Read with UTC accessors: Prisma returns
 * date-only columns as UTC midnight.
 */
export function dateString(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

/** Today's calendar date in Manila. */
function todayInManila(): { year: number; month: number; day: number } {
  const now = new Date(Date.now() + MANILA_OFFSET_MS);
  return { year: now.getUTCFullYear(), month: now.getUTCMonth(), day: now.getUTCDate() };
}

/** Completed years, in clinic-local time — a birthday today counts. */
export function ageFrom(dob: Date | null | undefined): number | null {
  if (!dob) return null;
  const today = todayInManila();

  let age = today.year - dob.getUTCFullYear();
  const beforeBirthday =
    today.month < dob.getUTCMonth() || (today.month === dob.getUTCMonth() && today.day < dob.getUTCDate());
  if (beforeBirthday) age -= 1;

  return age;
}

/**
 * The instant a Manila calendar day begins, as UTC. Every "on this date" filter
 * means a Manila day, because that is the day the clinic works — a naive
 * `new Date('2026-08-29')` is UTC midnight and would start the window eight
 * hours early, sweeping in the previous evening's appointments.
 */
export function manilaDayStart(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00.000+08:00`);
}

/** The instant the next Manila day begins — an exclusive upper bound. */
export function manilaDayEnd(date: string): Date {
  return new Date(manilaDayStart(date).getTime() + 24 * 60 * 60 * 1000);
}

/** A Manila wall clock (`HH:mm` or `HH:mm:ss`) on a given day, as a UTC instant. */
export function manilaInstant(date: string, time: string): Date {
  const [h = "00", m = "00", sec = "00"] = time.split(":");
  return new Date(`${date.slice(0, 10)}T${h.padStart(2, "0")}:${m}:${sec}+08:00`);
}

/** `HH:mm` on the Manila clock. */
export function clockInManila(date: Date): string {
  return new Date(date.getTime() + MANILA_OFFSET_MS).toISOString().slice(11, 16);
}

/** `HH:mm:ss` from a `@db.Time` column (stored as 1970-01-01 UTC). */
export function timeString(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString().slice(11, 19);
}

/** Today's date in Manila, `YYYY-MM-DD`. */
export function manilaToday(): string {
  return new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** True for a real `YYYY-MM-DD` calendar date. */
export function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(manilaDayStart(value).getTime());
}
