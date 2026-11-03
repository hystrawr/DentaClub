"use client";

import { use, useState } from "react";
import { CalendarPlus } from "lucide-react";
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

  // Upcoming always shows, so Book appointment is always there; Past only once loaded.
  const sections = [
    { title: "Upcoming", list: upcoming, empty: "Nothing booked ahead." },
    ...(appointments.data ? [{ title: "Past", list: past, empty: "No past visits." }] : []),
  ];

  return (
    <div className="p-4 sm:p-6">
      {sections.map(({ title, list, empty }) => (
        <section key={title} className="record-block">
          <div className="record-block-head" style={{ alignItems: "center" }}>
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <h3 className="text-[15px] font-semibold" style={{ color: "var(--color-foreground)" }}>
                {title}
              </h3>
              {appointments.data && (
                <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  {list.length} {list.length === 1 ? "appointment" : "appointments"}
                </span>
              )}
            </div>
            {title === "Upcoming" && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!patient.data}
                onClick={() => setBooking(Date.now())}
                data-print="hide"
              >
                <CalendarPlus size={14} /> Book appointment
              </button>
            )}
          </div>

          {appointments.isError ? (
            <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
              Appointments could not be loaded. Treat this list as unknown rather than empty.
            </p>
          ) : appointments.isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton" style={{ height: 44, borderRadius: 8 }} />
              ))}
            </div>
          ) : list.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
              {empty}
            </p>
          ) : (
            <table className="appt-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Appointment</th>
                  <th className="hidden md:table-cell">Dentist</th>
                  <th className="hidden md:table-cell">Chair</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => {
                  const s = styleFor(a.status);
                  return (
                    <tr
                      key={a.id}
                      tabIndex={0}
                      onClick={() => setSelectedId(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(a.id);
                        }
                      }}
                      aria-label={`Open the appointment on ${longDate(dateOf(a.scheduled_start))}`}
                    >
                      <td className="font-medium whitespace-nowrap">{longDate(dateOf(a.scheduled_start))}</td>
                      <td className="whitespace-nowrap" style={{ color: "var(--color-muted-foreground)" }}>
                        {clock(timeOf(a.scheduled_start))} – {clock(timeOf(a.scheduled_end))}
                      </td>
                      <td>{a.appointment_type?.name ?? "Appointment"}</td>
                      <td className="hidden md:table-cell">{a.provider?.name ?? "—"}</td>
                      <td className="hidden md:table-cell">{a.operatory?.name ?? "Unassigned"}</td>
                      <td>
                        <span className="chip" style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                          {s.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {booking && patient.data && (
        <NewAppointmentModal
          key={booking}
          onClose={() => setBooking(null)}
          defaultPatient={{ id: patient.data.id, name: patient.data.full_name }}
        />
      )}
      <div data-print="hide">
        <AppointmentDetailPanel appointmentId={selectedId} onClose={() => setSelectedId(null)} />
      </div>
    </div>
  );
}
