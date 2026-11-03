import type { Appointment, AppointmentStatus } from "@/types/api";
import { dateOf } from "./manila";

// One patient's appointments, as the Appointments screen's search shows them.

/** Still going to happen (or happening now): the patient is expected, waiting or in the chair. */
const STILL_ON: AppointmentStatus[] = ["scheduled", "confirmed", "arrived", "in_chair"];

export interface PatientAppointments {
  /** Today or later and still on, soonest first. */
  upcoming: Appointment[];
  /** Before today, or already over today, most recent first. */
  past: Appointment[];
}

/**
 * Splits a patient's appointments for the search panel. A booking later today
 * that is still on counts as upcoming; one cancelled for a future date is
 * neither, since it will not happen and has not happened.
 */
export function splitPatientAppointments(appointments: Appointment[], today: string): PatientAppointments {
  const sorted = [...appointments].sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));
  const upcoming = sorted.filter((a) => dateOf(a.scheduled_start) >= today && STILL_ON.includes(a.status));
  const past = sorted
    .filter((a) => dateOf(a.scheduled_start) < today || (dateOf(a.scheduled_start) === today && !STILL_ON.includes(a.status)))
    .reverse();
  return { upcoming, past };
}
