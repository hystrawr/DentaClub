"use client";

import Link from "next/link";
import type { Route } from "next";
import { FileText, X } from "lucide-react";
import { useAppointment } from "@/lib/api/appointments";
import { styleFor } from "@/lib/utils/appointment-status";
import { clock, timeOf } from "@/lib/utils/manila";
import { AppointmentActions } from "@/components/schedule/AppointmentActions";

/**
 * The bottom sheet an appointment's "View details" opens (from DentalOS's chairside AppointmentSheet).
 *
 * DentalOS's "Seat Patient" also opened a clinical encounter and jumped to it;
 * there are no encounters here, so seating only moves the status, and "Open
 * Chart" goes to the patient's tooth chart.
 */
export function AppointmentSheet({ appointmentId, onClose }: { appointmentId: string; onClose: () => void }) {
  const { data: apt, isLoading, isError } = useAppointment(appointmentId);

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(15,23,42,0.25)" }} onClick={onClose} aria-hidden="true" />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden mx-auto"
        style={{ background: "var(--color-surface)", boxShadow: "0 -8px 40px -8px rgba(0,0,0,0.18)", maxHeight: "80vh", maxWidth: 640 }}
        role="dialog"
        aria-modal="true"
        aria-label={`Appointment details — ${apt?.patient?.full_name ?? "loading"}`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="rounded-full" style={{ width: 36, height: 4, background: "var(--color-border)" }} aria-hidden="true" />
        </div>

        <div className="flex items-start justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
              {apt?.patient?.full_name ?? (isLoading ? "Loading…" : "Blocked time")}
            </h2>
            <p className="text-sm mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
              {apt?.appointment_type?.name ?? "—"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-subtle)]"
            style={{ width: 44, height: 44, border: "1px solid var(--color-border)" }}
            aria-label="Close"
          >
            <X size={18} style={{ color: "var(--color-muted-foreground)" }} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(80vh - 140px)" }}>
          {isError && (
            <p className="text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
              This appointment could not be loaded. Close and try again.
            </p>
          )}

          {apt && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Time", value: `${clock(timeOf(apt.scheduled_start))} – ${clock(timeOf(apt.scheduled_end))}` },
                  { label: "Status", value: styleFor(apt.status).label },
                  { label: "Dentist", value: apt.provider?.name ?? "—" },
                  { label: "Chair", value: apt.operatory?.name ?? "Unassigned" },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-2xl p-3" style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}>
                    <p className="text-xs font-medium mb-1" style={{ color: "var(--color-subtle-foreground)" }}>
                      {label}
                    </p>
                    <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {apt.notes && (
                <p className="text-sm rounded-2xl p-3" style={{ background: "var(--color-surface-subtle)" }}>
                  {apt.notes}
                </p>
              )}

              <AppointmentActions key={apt.id} appointment={apt} size="lg" />

              {apt.patient && (
                <Link
                  href={`/patients/${apt.patient.id}/chart` as Route}
                  className="flex items-center justify-center gap-2 rounded-2xl font-semibold"
                  style={{ minHeight: 48, border: "1px solid var(--color-border)", color: "var(--color-primary)" }}
                >
                  <FileText size={17} /> Open Chart
                </Link>
              )}
            </>
          )}

          <button
            onClick={onClose}
            className="w-full flex items-center justify-center rounded-2xl font-semibold transition-colors hover:bg-[var(--color-surface-subtle)]"
            style={{ minHeight: 48, background: "var(--color-surface-subtle)", color: "var(--color-muted-foreground)", border: "1px solid var(--color-border)" }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </>
  );
}
