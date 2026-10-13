"use client";

import { clock } from "@/lib/utils/manila";

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

/** One appointment in the dashboard's upcoming list (from DentalOS's chairside PatientCard). */
export function AppointmentRow({
  patientName,
  appointmentType,
  start,
  end,
  color,
  onView,
}: {
  patientName: string;
  appointmentType: string | null;
  start: string; // "09:30"
  end: string; // "10:00"
  color: string;
  onView: () => void;
}) {
  return (
    <li
      className="grid items-center gap-4 rounded-2xl py-2.5 pl-3 pr-4 transition-shadow duration-200 hover:shadow-md grid-cols-[4px_1fr_auto] sm:grid-cols-[4px_1fr_auto_auto]"
      style={{ border: "1px solid var(--color-border)" }}
    >
      <span className="h-9 rounded" style={{ background: color }} aria-hidden="true" />
      <div className="flex items-center gap-3 min-w-0">
        <PatientAvatar name={patientName} color={color} />
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "var(--color-foreground)" }}>
            {patientName}
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
