import { ApiError } from "@/lib/api/client";
import { timeOf } from "@/lib/utils/manila";
import type { AppointmentStatus } from "@/types/api";

export interface StatusStyle {
  label: string;
  bg: string;
  border: string;
  text: string;
  dot: string;
}

/**
 * Every status the machine can produce — exhaustive by type, so adding a status
 * fails the build here instead of crashing a screen (from DentalOS PatientCard).
 */
const STATUS_STYLE: Record<AppointmentStatus, StatusStyle> = {
  scheduled: { label: "Scheduled", bg: "#DBEAFE", border: "#93C5FD", text: "#1D4ED8", dot: "#2563EB" },
  confirmed: { label: "Confirmed", bg: "#D1FAE5", border: "#6EE7B7", text: "#065F46", dot: "#059669" },
  arrived: { label: "Arrived", bg: "#E0E7FF", border: "#A5B4FC", text: "#3730A3", dot: "#4F46E5" },
  in_chair: { label: "In Chair", bg: "#FEF3C7", border: "#FCD34D", text: "#92400E", dot: "#D97706" },
  completed: { label: "Completed", bg: "#F1F5F9", border: "#CBD5E1", text: "#475569", dot: "#64748B" },
  cancelled: { label: "Cancelled", bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#DC2626" },
  no_show: { label: "No Show", bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B", dot: "#DC2626" },
};

/** A status from the wire this build does not know must not take a screen down. */
const UNKNOWN_STATUS: StatusStyle = { label: "Unknown", bg: "#F1F5F9", border: "#CBD5E1", text: "#475569", dot: "#94A3B8" };

export const styleFor = (status: string): StatusStyle => STATUS_STYLE[status as AppointmentStatus] ?? UNKNOWN_STATUS;

/**
 * The one forward step each status offers — mirrors `ALLOWED` in the API's
 * appointment service. Terminal states offer nothing.
 */
export const NEXT_ACTION: Partial<Record<AppointmentStatus, { to: AppointmentStatus; label: string }>> = {
  scheduled: { to: "confirmed", label: "Confirm" },
  confirmed: { to: "arrived", label: "Check In" },
  arrived: { to: "in_chair", label: "Seat Patient" },
  in_chair: { to: "completed", label: "Mark Complete" },
};

/** The side exits the API allows from each status. */
export const CAN_CANCEL: AppointmentStatus[] = ["scheduled", "confirmed", "arrived"];
export const CAN_NO_SHOW: AppointmentStatus[] = ["scheduled", "confirmed"];
/** Only a visit still to come can move; the API refuses the rest too. */
export const CAN_RESCHEDULE: AppointmentStatus[] = ["scheduled", "confirmed"];

/** The appointment a 409 (double-booking) names, if the error is one. */
export function conflictOf(error: unknown) {
  return error instanceof ApiError && error.status === 409
    ? (error.body as { conflicting_appointment?: { scheduled_start: string; scheduled_end: string } } | undefined)?.conflicting_appointment
    : undefined;
}

/** " It overlaps the appointment at 09:00–09:30." for a double-booking, else "". */
export function conflictNote(error: unknown): string {
  const conflict = conflictOf(error);
  return conflict ? ` It overlaps the appointment at ${timeOf(conflict.scheduled_start)}–${timeOf(conflict.scheduled_end)}.` : "";
}

/** A pale wash of a colour over white — for appointment cards tinted by procedure. */
export const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, white)`;

/** "Dr. Miguel Reyes" → "MR"; skips titles so dentists don't all read "D". */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word && !/^(dr|dra|drg)\.?$/i.test(word))
    .map((word) => word[0]!.toUpperCase())
    .slice(0, 2)
    .join("");
}

/** The colour an appointment is drawn in: its procedure, else its dentist, else its status. */
export function appointmentColor(apt: {
  status: string;
  appointment_type: { color_hex: string } | null;
  provider: { color_hex: string } | null;
}): string {
  return apt.appointment_type?.color_hex || apt.provider?.color_hex || styleFor(apt.status).dot;
}
