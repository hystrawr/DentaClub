"use client";

import { use, useState } from "react";
import { CalendarDays, CalendarPlus } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { AppointmentDetailPanel } from "@/components/schedule/AppointmentDetailPanel";
import { NewAppointmentModal } from "@/components/schedule/NewAppointmentModal";
import { useAppointments } from "@/lib/api/appointments";
import { usePatient } from "@/lib/api/patients";
import { styleFor } from "@/lib/utils/appointment-status";
import { clock, dateOf, longDate, manilaToday, timeOf } from "@/lib/utils/manila";

/** One patient's appointments — upcoming first, then past — and a way to book the next. */
export default function PatientAppointmentsPage({ params }: PageProps<"/patients/[id]/appointments">) {
  const { id } = use(params);
  const patient = usePatient(id);
  const appointments = useAppointments({ patient_id: id });
  const [booking, setBooking] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const today = manilaToday();
  const rows = appointments.data ?? [];
  const upcoming = rows.filter((a) => dateOf(a.scheduled_start) >= today);
  const past = rows.filter((a) => dateOf(a.scheduled_start) < today).reverse();

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
          Appointments
        </h2>
        <button type="button" className="btn btn-primary" disabled={!patient.data} onClick={() => setBooking(Date.now())}>
          <CalendarPlus size={15} /> Book appointment
        </button>
      </div>

      {appointments.isError && (
        <p className="text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
          Appointments could not be loaded. Treat this list as unknown rather than empty.
        </p>
      )}

      {!appointments.isLoading && !appointments.isError && rows.length === 0 && (
        <div className="card-premium">
          <EmptyState icon={CalendarDays} title="No appointments yet" description="Book this patient's first visit." />
        </div>
      )}

      {[
        { title: "Upcoming", list: upcoming },
        { title: "Past", list: past },
      ].map(
        ({ title, list }) =>
          list.length > 0 && (
            <div key={title} className="card-premium overflow-hidden">
              <p
                className="px-5 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--color-subtle-foreground)", borderBottom: "1px solid var(--color-border)" }}
              >
                {title}
              </p>
              <ul className="divide-y">
                {list.map((a) => {
                  const s = styleFor(a.status);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.id)}
                        className="w-full text-left flex items-center gap-4 px-5 py-3 table-row-hover"
                      >
                        <div className="w-48 shrink-0">
                          <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                            {longDate(dateOf(a.scheduled_start))}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                            {clock(timeOf(a.scheduled_start))} – {clock(timeOf(a.scheduled_end))}
                          </p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                            {a.appointment_type?.name ?? "Appointment"}
                          </p>
                          <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                            {a.provider?.name ?? "—"} · {a.operatory?.name ?? "Unassigned"}
                          </p>
                        </div>
                        <span className="chip" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
      )}

      {booking && patient.data && (
        <NewAppointmentModal
          key={booking}
          onClose={() => setBooking(null)}
          defaultPatient={{ id: patient.data.id, name: patient.data.full_name }}
        />
      )}
      <AppointmentDetailPanel appointmentId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
