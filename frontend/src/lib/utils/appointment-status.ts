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
 * fails the build here instead of crashing a screen.
 */
const STATUS_STYLE: Record<AppointmentStatus, StatusStyle> = {
  // Pale tint, a border one step darker, and dark text of the same hue. Olive is the brand's own state (booked).
  scheduled: { label: "Scheduled", bg: "#EEF0DA", border: "#C9CEA4", text: "#424A1F", dot: "#6B7530" },
  confirmed: { label: "Confirmed", bg: "#DCEBD3", border: "#A9CA97", text: "#24521F", dot: "#3D7A33" },
  arrived: { label: "Arrived", bg: "#E5E6F0", border: "#B4B8D3", text: "#3D4170", dot: "#5A5F8A" },
  in_chair: { label: "In Chair", bg: "#FBEBD3", border: "#EBC48C", text: "#7A3B05", dot: "#B8650F" },
  completed: { label: "Completed", bg: "#F0F1E6", border: "#CDD0B3", text: "#4A4F38", dot: "#7A7F66" },
  cancelled: { label: "Cancelled", bg: "#FDE7E4", border: "#F2AEA5", text: "#8A1C12", dot: "#B42318" },
  no_show: { label: "No Show", bg: "#FDE7E4", border: "#F2AEA5", text: "#8A1C12", dot: "#B42318" },
};

/** A status from the wire this build does not know must not take a screen down. */
const UNKNOWN_STATUS: StatusStyle = { label: "Unknown", bg: "#F0F1E6", border: "#CDD0B3", text: "#4A4F38", dot: "#8C907A" };

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
/** Not over yet: while a patient has one of these ahead, the API won't delete them. */
export const OPEN_STATUSES: AppointmentStatus[] = ["scheduled", "confirmed", "arrived", "in_chair"];

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
