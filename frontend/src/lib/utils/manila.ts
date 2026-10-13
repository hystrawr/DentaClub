/**
 * Calendar maths in clinic time (Asia/Manila, UTC+8, no daylight saving).
 *
 * DentalOS's calendar used the browser's local clock and `toISOString()` (UTC)
 * for date keys, so before 08:00 in Manila "today" was yesterday and a laptop
 * set to another timezone drew every appointment at the wrong hour. Here every
 * date is a `YYYY-MM-DD` string in Manila, and appointment times are read
 * straight off the API's `+08:00` timestamps.
 */

const DAY_MS = 86_400_000;
const MANILA_OFFSET_MS = 8 * 3_600_000;

/** Today's date in Manila. */
export function manilaToday(): string {
  return new Date(Date.now() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

/** `2026-10-05` + n days. */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday, for a calendar date. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The Monday-to-Sunday week containing `date`. */
export function weekOf(date: string): string[] {
  const monday = addDays(date, -((weekdayOf(date) + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** The date part of an API timestamp (already Manila-local). */
export const dateOf = (iso: string) => iso.slice(0, 10);

/** `HH:mm` of an API timestamp (already Manila-local). */
export const timeOf = (iso: string) => iso.slice(11, 16);

/** Minutes since midnight of an API timestamp. */
export function minutesOf(iso: string): number {
  const [h, m] = timeOf(iso).split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** A Manila wall-clock time on a date, as the API wants it. */
export const manilaTimestamp = (date: string, hhmm: string) => `${date}T${hhmm}:00+08:00`;

/** `HH:mm` + minutes. */
export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.min((h ?? 0) * 60 + (m ?? 0) + minutes, 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "Monday, 5 October 2026" */
export function longDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "Oct 5" */
export function shortDate(date: string, withYear = false): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

/** "October 5, 2026" */
export function fullDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "9:30 AM" */
export function clock(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** The hour (0–23) on the clinic's clock right now. */
export function manilaHour(): number {
  return new Date(Date.now() + MANILA_OFFSET_MS).getUTCHours();
}

/** Minutes since midnight on the clinic's clock right now. */
export function manilaMinutes(): number {
  const now = new Date(Date.now() + MANILA_OFFSET_MS);
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

/** "October 2026" */
export function monthYear(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
}
