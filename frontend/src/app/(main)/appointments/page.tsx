"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { PatientSearch } from "@/components/patients/PatientSearch";
import { AppointmentFilter, DEFAULT_FILTER, matchesFilter, type ScheduleFilter } from "@/components/schedule/AppointmentFilter";
import { AppointmentPopover } from "@/components/schedule/AppointmentPopover";
import { NewAppointmentModal } from "@/components/schedule/NewAppointmentModal";
import { PatientAppointmentsPanel } from "@/components/schedule/PatientAppointmentsPanel";
import { ScheduleCalendar, type CalendarGoTo } from "@/components/schedule/ScheduleCalendar";
import { addMinutes, dateOf, longDate, manilaToday, nextBookableStart } from "@/lib/utils/manila";
import type { Appointment } from "@/types/api";

interface CreateDefaults {
  date: string;
  startTime: string;
  endTime: string;
  /** Filled in when booking from a searched patient's "no upcoming appointments". */
  patient?: { id: string; name: string };
  /** Bumped on every open, so the form remounts with fresh answers. */
  key: number;
}

/**
 * The schedule: a week calendar with a popover beside whichever appointment is
 * clicked. Only the calendar grid scrolls.
 *
 * Searching a patient here shows their appointments (not their record):
 * picking one moves the calendar to it and opens it.
 */
export default function AppointmentsPage() {
  const [creating, setCreating] = useState<CreateDefaults | null>(null);
  const [selected, setSelected] = useState<{ id: string; anchor: DOMRect } | null>(null);
  const [filter, setFilter] = useState<ScheduleFilter>(DEFAULT_FILTER);
  const [searched, setSearched] = useState<{ id: string; name: string } | null>(null);
  const [goTo, setGoTo] = useState<CalendarGoTo | null>(null);

  const openCreate = (defaults: Omit<CreateDefaults, "key">) => setCreating({ ...defaults, key: Date.now() });
  // The next quarter-hour still to come, not a fixed 09:00 that may already have passed.
  const openCreateNext = (patient?: { id: string; name: string }) => {
    const { date, time } = nextBookableStart();
    openCreate({ date, startTime: time, endTime: addMinutes(time, 30), patient });
  };
  const closePopover = useCallback(() => setSelected(null), []);
  const select = useCallback((id: string, anchor: DOMRect) => setSelected({ id, anchor }), []);
  const closeSearched = useCallback(() => setSearched(null), []);
  const visible = useCallback((apt: Appointment) => matchesFilter(filter, apt), [filter]);

  return (
    <div className="flex flex-col gap-4 h-full px-5 sm:px-10 lg:px-12 py-6">
      <div className="flex flex-wrap items-end gap-3 shrink-0">
        <div className="flex-1 min-w-48">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
            Appointments
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            {longDate(manilaToday())}
          </p>
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-0 sm:flex-none sm:w-60">
            <PatientSearch
              placeholder="Search patients…"
              onSelect={(p) => {
                setSelected(null);
                setSearched({ id: p.id, name: p.name });
              }}
            />
            {searched && (
              <PatientAppointmentsPanel
                key={searched.id}
                patient={searched}
                onClose={closeSearched}
                onOpen={(apt, from) => {
                  setSearched(null);
                  setGoTo({ date: dateOf(apt.scheduled_start), appointmentId: apt.id, fallback: from, key: Date.now() });
                }}
                onBook={() => {
                  setSearched(null);
                  openCreateNext(searched);
                }}
              />
            )}
          </div>
          <AppointmentFilter value={filter} onChange={setFilter} />
          <button
            className="btn btn-primary shrink-0"
            onClick={() => openCreateNext()}
            aria-label="New Appointment"
          >
            <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
            <span className="hidden sm:inline">New Appointment</span>
          </button>
        </div>
      </div>

      {/* Fills the space left above the bottom bar or window edge; the calendar scrolls inside it. */}
      <div className="flex-1 min-h-[240px]">
        <ScheduleCalendar
          selectedId={selected?.id ?? null}
          onSelect={select}
          filter={visible}
          goTo={goTo}
        />
      </div>

      <AppointmentPopover appointmentId={selected?.id ?? null} anchor={selected?.anchor ?? null} onClose={closePopover} />

      {creating && (
        <NewAppointmentModal
          key={creating.key}
          onClose={() => setCreating(null)}
          defaultDate={creating.date}
          defaultStartTime={creating.startTime}
          defaultEndTime={creating.endTime}
          defaultPatient={creating.patient}
        />
      )}
    </div>
  );
}
