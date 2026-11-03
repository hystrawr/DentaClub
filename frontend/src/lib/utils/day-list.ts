import type { Appointment, AppointmentStatus } from "@/types/api";
import { addDays, minutesOf } from "./manila";

// What the dashboard lists for the day picked in its calendar.

export type DayKind = "past" | "today" | "tomorrow" | "upcoming";

/** One tag per row: where the patient is in the day, or how a past booking ended. */
export type RowTag = "next" | "late" | "arrived" | "in_chair" | "completed" | "no_show" | "cancelled";

export interface DayRow {
  appointment: Appointment;
  tag: RowTag | null;
}

export interface DayPlan {
  kind: DayKind;
  /** The list itself, earliest first. */
  rows: DayRow[];
  /** Today only: patients already seen, folded away under the list. */
  completed: DayRow[];
  /** Anything was booked that day (cancellations and no-shows aside). */
  bookedAny: boolean;
}

export const TITLE: Record<DayKind, string> = {
  past: "Past appointments",
  today: "Today's appointments",
  tomorrow: "Tomorrow's appointments",
  upcoming: "Upcoming appointments",
};

/** Bookings that never took a chair. Shown only on past days, where the list is a record. */
const OFF_THE_BOOKS: AppointmentStatus[] = ["cancelled", "no_show"];

export function dayKind(date: string, today: string): DayKind {
  if (date < today) return "past";
  if (date === today) return "today";
  return date === addDays(today, 1) ? "tomorrow" : "upcoming";
}

const byStart = (a: Appointment, b: Appointment) => a.scheduled_start.localeCompare(b.scheduled_start);

/**
 * The list for `date`. `now` is minutes since midnight on the clinic's clock,
 * and only matters today: a booking whose start time has passed without the
 * patient arriving is Late, and the earliest one still to come is Next.
 */
export function planDay(appointments: Appointment[], date: string, today: string, now: number): DayPlan {
  const kind = dayKind(date, today);
  const sorted = [...appointments].sort(byStart);
  const booked = sorted.filter((a) => !OFF_THE_BOOKS.includes(a.status));

  if (kind === "past") {
    const ended: Partial<Record<AppointmentStatus, RowTag>> = { completed: "completed", no_show: "no_show", cancelled: "cancelled" };
    return { kind, rows: sorted.map((a) => ({ appointment: a, tag: ended[a.status] ?? null })), completed: [], bookedAny: booked.length > 0 };
  }

  if (kind !== "today") {
    return { kind, rows: booked.map((a) => ({ appointment: a, tag: null })), completed: [], bookedAny: booked.length > 0 };
  }

  const waiting = (a: Appointment) => a.status === "scheduled" || a.status === "confirmed";
  const isLate = (a: Appointment) => waiting(a) && minutesOf(a.scheduled_start) < now;
  const next = booked.find((a) => waiting(a) && !isLate(a));

  const rows = booked
    .filter((a) => a.status !== "completed")
    .map((a): DayRow => ({
      appointment: a,
      tag:
        a.status === "in_chair" ? "in_chair"
        : a.status === "arrived" ? "arrived"
        : isLate(a) ? "late"
        : a === next ? "next"
        : null,
    }));
  const completed = booked.filter((a) => a.status === "completed").map((a): DayRow => ({ appointment: a, tag: "completed" }));

  return { kind, rows, completed, bookedAny: booked.length > 0 };
}
