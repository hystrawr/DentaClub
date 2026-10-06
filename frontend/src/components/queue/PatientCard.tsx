"use client";

import { Clock } from "lucide-react";
import { styleFor } from "@/lib/utils/appointment-status";
import type { AppointmentStatus } from "@/types/api";

/** One appointment on the queue board (from DentalOS's chairside PatientCard). */
export function PatientCard({
  patientName,
  appointmentType,
  scheduledStart,
  status,
  onTap,
}: {
  patientName: string;
  appointmentType: string;
  scheduledStart: string; // "09:30"
  status: AppointmentStatus;
  onTap?: () => void;
}) {
  const cfg = styleFor(status);
  const done = status === "completed" || status === "cancelled" || status === "no_show";

  return (
    <button
      type="button"
      className="relative w-full text-left card-premium p-4 transition-all duration-150 hover:shadow-md"
      style={{ minHeight: 100, cursor: "pointer", opacity: done ? 0.6 : 1, borderLeft: `4px solid ${cfg.dot}` }}
      onClick={onTap}
      aria-label={`${patientName} — ${appointmentType} at ${scheduledStart}, ${cfg.label}`}
    >
      <p className="text-base font-bold leading-tight mb-0.5" style={{ color: "var(--color-foreground)" }}>
        {patientName}
      </p>
      <p className="text-xs mb-3" style={{ color: "var(--color-muted-foreground)" }}>
        {appointmentType}
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock size={12} style={{ color: "var(--color-subtle-foreground)" }} />
          <span className="text-xs font-mono" style={{ color: "var(--color-muted-foreground)" }}>
            {scheduledStart}
          </span>
        </div>
        <span className="chip" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
          <span className="rounded-full shrink-0" style={{ width: 6, height: 6, background: cfg.dot, display: "inline-block" }} aria-hidden="true" />
          {cfg.label}
        </span>
      </div>
    </button>
  );
}

/** A chair with nothing booked today. */
export function EmptyOperatorySlot() {
  return (
    <div
      className="w-full rounded-2xl flex items-center justify-center text-xs"
      style={{ minHeight: 100, border: "2px dashed var(--color-border)", color: "var(--color-subtle-foreground)" }}
      aria-label="Empty chair"
    >
      No appointment
    </div>
  );
}
