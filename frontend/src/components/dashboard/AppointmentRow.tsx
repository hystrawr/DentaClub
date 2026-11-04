"use client";

import { styleFor } from "@/lib/utils/appointment-status";
import type { RowTag } from "@/lib/utils/day-list";
import { clock } from "@/lib/utils/manila";

/** How each tag looks: Next in the brand olive, Late in amber, the rest in their status colours. */
const TAG: Record<RowTag, { label: string; bg: string; text: string }> = {
  next: { label: "Next", bg: "var(--color-primary)", text: "var(--color-primary-foreground)" },
  late: { label: "Late", bg: "var(--color-warning-light)", text: "var(--color-warning)" },
  arrived: { label: "Arrived", bg: styleFor("arrived").bg, text: styleFor("arrived").text },
  in_chair: { label: "In chair", bg: styleFor("in_chair").bg, text: styleFor("in_chair").text },
  completed: { label: "Completed", bg: styleFor("completed").bg, text: styleFor("completed").text },
  no_show: { label: "No-show", bg: styleFor("no_show").bg, text: styleFor("no_show").text },
  cancelled: { label: "Cancelled", bg: styleFor("cancelled").bg, text: styleFor("cancelled").text },
};

/** "Barby Peregil" → "BP"; one-word names give one letter. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "—";
}

/** A patient's initials in a tinted circle; `color` is a 6-digit hex, falling back to the brand blue. */
export function PatientAvatar({ name, color }: { name: string; color?: string | null }) {
  const tint = color && /^#[0-9a-f]{6}$/i.test(color) ? color : null;
  return (
    <div
      className="flex items-center justify-center rounded-full text-[13px] font-bold shrink-0"
      style={{
        width: 36,
        height: 36,
        background: tint ? `${tint}1F` : "var(--color-primary-light)",
        color: tint ?? "var(--color-primary)",
      }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </div>
  );
}

/**
 * One appointment in the dashboard's list.
 * `tag` says where the patient is in the day; `muted` dims a booking that is over.
 */
export function AppointmentRow({
  patientName,
  appointmentType,
  start,
  end,
  color,
  onView,
  tag = null,
  muted = false,
}: {
  patientName: string;
  appointmentType: string | null;
  start: string; // "09:30"
  end: string; // "10:00"
  color: string;
  onView: () => void;
  tag?: RowTag | null;
  muted?: boolean;
}) {
  const t = tag ? TAG[tag] : null;
  return (
    <li
      className="grid items-center gap-4 rounded-2xl py-2.5 pl-3 pr-4 transition-shadow duration-200 hover:shadow-md grid-cols-[4px_1fr_auto] sm:grid-cols-[4px_1fr_auto_auto]"
      style={{ border: "1px solid var(--color-border)", opacity: muted ? 0.65 : 1 }}
    >
      {/* A stripe in the service's colour, the same colour as on the calendar. */}
      <span className="h-9 rounded" style={{ background: color }} aria-hidden="true" />
      <div className="flex items-center gap-3 min-w-0">
        <PatientAvatar name={patientName} color={color} />
        <div className="min-w-0">
          <p className="flex items-center gap-2 min-w-0 text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            <span className="truncate">{patientName}</span>
            {t && (
              <span className="chip py-0! text-[11px]! shrink-0" style={{ background: t.bg, color: t.text }}>
                {t.label}
              </span>
            )}
          </p>
          <p className="text-[11px] truncate" style={{ color: "var(--color-subtle-foreground)" }}>
            Patient{appointmentType ? ` · ${appointmentType}` : ""}
          </p>
        </div>
      </div>
      <p className="text-[13px] font-mono whitespace-nowrap" style={{ color: "var(--color-foreground)" }}>
        {clock(start)} – {clock(end)}
      </p>
      <button
        type="button"
        onClick={onView}
        className="col-start-2 sm:col-start-auto justify-self-start rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors hover:brightness-95"
        style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
        aria-label={`View details — ${patientName} at ${clock(start)}`}
      >
        View details
      </button>
    </li>
  );
}
