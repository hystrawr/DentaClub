"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertCircle, Armchair, Calendar, Clock, ExternalLink, FileText, Stethoscope, User, X } from "lucide-react";
import { useAppointment } from "@/lib/api/appointments";
import { styleFor } from "@/lib/utils/appointment-status";
import { clock, dateOf, longDate, minutesOf, timeOf } from "@/lib/utils/manila";
import { AppointmentActions } from "./AppointmentActions";

/**
 * The slide-in appointment panel, with its status actions. Times are shown in clinic time.
 */
export function AppointmentDetailPanel({ appointmentId, onClose }: { appointmentId: string | null; onClose: () => void }) {
  const { data: apt, isLoading } = useAppointment(appointmentId);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = appointmentId !== null;

  return (
    <>
      <div
        className="fixed inset-0 z-30 transition-opacity duration-200"
        style={{ background: "rgba(15,23,42,0.25)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="fixed right-0 top-0 bottom-0 z-40 flex flex-col overflow-hidden"
        style={{
          width: 380,
          background: "var(--color-surface)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.08)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Appointment details"
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-bold" style={{ color: "var(--color-foreground)" }}>
            Appointment Details
          </h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-subtle)]"
            style={{ width: 30, height: 30, border: "1px solid var(--color-border)" }}
            aria-label="Close panel"
          >
            <X size={14} style={{ color: "var(--color-muted-foreground)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <div className="space-y-4" aria-busy="true">
              {[80, 60, 70, 50].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 32, width: `${w}%` }} />
              ))}
            </div>
          )}

          {apt && !isLoading && (
            <div className="space-y-4">
              <span
                className="chip"
                style={{ background: styleFor(apt.status).bg, color: styleFor(apt.status).text, border: `1px solid ${styleFor(apt.status).border}` }}
              >
                <span className="rounded-full" style={{ width: 6, height: 6, background: styleFor(apt.status).dot }} aria-hidden="true" />
                {styleFor(apt.status).label}
              </span>

              {apt.patient ? (
                <DetailRow
                  icon={User}
                  label="Patient"
                  value={
                    <Link
                      href={`/patients/${apt.patient.id}/info` as Route}
                      className="inline-flex items-center gap-1 hover:underline"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {apt.patient.full_name}
                      <ExternalLink size={11} aria-hidden="true" />
                    </Link>
                  }
                />
              ) : (
                <DetailRow icon={User} label="Patient" value="None — blocked time" />
              )}

              <DetailRow icon={Calendar} label="Date" value={longDate(dateOf(apt.scheduled_start))} />
              <DetailRow
                icon={Clock}
                label="Time"
                value={
                  <span>
                    {clock(timeOf(apt.scheduled_start))} – {clock(timeOf(apt.scheduled_end))}
                    <span style={{ color: "var(--color-subtle-foreground)", fontWeight: 400 }}>
                      {" "}({minutesOf(apt.scheduled_end) - minutesOf(apt.scheduled_start)} min)
                    </span>
                  </span>
                }
              />
              {apt.appointment_type && <DetailRow icon={Stethoscope} label="Procedure" value={apt.appointment_type.name} />}
              {apt.provider && <DetailRow icon={User} label="Dentist" value={apt.provider.name} />}
              <DetailRow icon={Armchair} label="Chair" value={apt.operatory?.name ?? "Unassigned"} />
              {apt.actual_start && (
                <DetailRow
                  icon={Clock}
                  label="Seated / finished"
                  value={`${clock(timeOf(apt.actual_start))}${apt.actual_end ? ` – ${clock(timeOf(apt.actual_end))}` : " – in progress"}`}
                />
              )}
              {apt.notes && <DetailRow icon={FileText} label="Notes" value={<span className="whitespace-pre-wrap">{apt.notes}</span>} />}
              {apt.cancellation_reason && <DetailRow icon={AlertCircle} label="Cancellation reason" value={apt.cancellation_reason} />}

              <div className="pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
                <AppointmentActions key={apt.id} appointment={apt} />
              </div>
            </div>
          )}
        </div>

        {apt?.patient && (
          <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
            <Link
              href={`/patients/${apt.patient.id}/chart` as Route}
              className="btn btn-secondary w-full"
            >
              Open Patient Chart <ExternalLink size={13} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
}

/** One labelled line of the panel, with its icon. */
function DetailRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex items-center justify-center rounded-xl shrink-0 mt-0.5"
        style={{ width: 32, height: 32, background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}
        aria-hidden="true"
      >
        <Icon size={14} style={{ color: "var(--color-muted-foreground)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
          {label}
        </p>
        <div className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
          {value}
        </div>
      </div>
    </div>
  );
}
