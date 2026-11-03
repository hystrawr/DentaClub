"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronDown, Plus, X } from "lucide-react";
import { useAppointments } from "@/lib/api/appointments";
import { styleFor } from "@/lib/utils/appointment-status";
import { clock, dateOf, manilaToday, shortDate, timeOf } from "@/lib/utils/manila";
import { splitPatientAppointments } from "@/lib/utils/patient-appointments";
import type { Appointment } from "@/types/api";

/**
 * A patient's appointments, opened from the Appointments screen's search.
 * Upcoming ones first; picking one moves the calendar to it and opens it.
 * With none upcoming it offers to book one, the patient already filled in.
 * Past ones wait behind "Show past appointments".
 */
export function PatientAppointmentsPanel({
  patient,
  onClose,
  onOpen,
  onBook,
}: {
  patient: { id: string; name: string };
  onClose: () => void;
  /** An appointment was picked; `from` is its row, for anchoring if the calendar can't show it. */
  onOpen: (appointment: Appointment, from: DOMRect) => void;
  onBook: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showPast, setShowPast] = useState(false);
  const { data, isLoading, isError } = useAppointments({ patient_id: patient.id });
  const { upcoming, past } = splitPatientAppointments(data ?? [], manilaToday());

  // Closes on Escape or a press outside it, like the Filter menu.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Appointments for ${patient.name}`}
      className="absolute left-0 z-40 mt-2 w-[min(360px,calc(100vw-2.5rem))] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: "var(--color-foreground)" }}>
            {patient.name}
          </p>
          <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            {isLoading
              ? "Loading appointments…"
              : `${upcoming.length} upcoming appointment${upcoming.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button type="button" onClick={onClose} className="btn-ghost p-1 rounded-md shrink-0" aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton" style={{ height: 52 }} />
            ))}
          </div>
        ) : isError ? (
          <p className="p-3 text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
            Appointments could not be loaded.
          </p>
        ) : (
          <>
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-3 py-5 text-center text-sm" style={{ color: "var(--color-subtle-foreground)" }}>
                No upcoming appointments.
                <button type="button" className="btn btn-primary btn-sm" onClick={onBook}>
                  <Plus size={14} aria-hidden="true" /> Book appointment
                </button>
              </div>
            ) : (
              <ul>
                {upcoming.map((a) => (
                  <Row key={a.id} appointment={a} onOpen={onOpen} />
                ))}
              </ul>
            )}

            {past.length > 0 && (
              <>
                <button
                  type="button"
                  className="mt-1 ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold hover:bg-[var(--color-surface-subtle)]"
                  style={{ color: "var(--color-muted-foreground)" }}
                  aria-expanded={showPast}
                  onClick={() => setShowPast((v) => !v)}
                >
                  {showPast ? "Hide" : "Show"} past appointments ({past.length})
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    style={{ transform: showPast ? "rotate(180deg)" : undefined, transition: "transform 150ms ease" }}
                  />
                </button>
                {showPast && (
                  <ul className="mt-1">
                    {past.map((a) => (
                      <Row key={a.id} appointment={a} onOpen={onOpen} withStatus />
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="shrink-0 px-4 py-2.5 text-xs" style={{ borderTop: "1px solid var(--color-border)" }}>
        <Link
          href={`/patients/${patient.id}/info` as Route}
          className="font-semibold hover:underline"
          style={{ color: "var(--color-primary)" }}
        >
          Open patient record →
        </Link>
      </div>
    </div>
  );
}

/** One appointment: when, what and with whom. Past ones also say how they ended. */
function Row({
  appointment: a,
  onOpen,
  withStatus = false,
}: {
  appointment: Appointment;
  onOpen: (appointment: Appointment, from: DOMRect) => void;
  withStatus?: boolean;
}) {
  const status = styleFor(a.status);
  const what = [a.appointment_type?.name, a.provider?.name].filter(Boolean).join(" · ");
  return (
    <li>
      <button
        type="button"
        onClick={(e) => onOpen(a, e.currentTarget.getBoundingClientRect())}
        className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--color-surface-subtle)]"
      >
        <span className="w-1 self-stretch rounded" style={{ background: a.appointment_type?.color_hex ?? status.dot }} aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            {shortDate(dateOf(a.scheduled_start), true)} · {clock(timeOf(a.scheduled_start))}
          </span>
          {what && (
            <span className="block text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
              {what}
            </span>
          )}
        </span>
        {withStatus && (
          <span className="chip !py-0 !text-[11px] shrink-0" style={{ background: status.bg, color: status.text }}>
            {status.label}
          </span>
        )}
      </button>
    </li>
  );
}
