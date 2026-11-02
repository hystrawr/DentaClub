"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { PatientSearch } from "@/components/frontdesk/PatientSearch";
import { AppointmentFilter, DEFAULT_FILTER, matchesFilter, type ScheduleFilter } from "@/components/schedule/AppointmentFilter";
import { AppointmentPopover } from "@/components/schedule/AppointmentPopover";
import { NewAppointmentModal } from "@/components/schedule/NewAppointmentModal";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { longDate, manilaToday } from "@/lib/utils/manila";
import type { Appointment } from "@/types/api";

interface CreateDefaults {
  date: string;
  startTime: string;
  endTime: string;
  /** Bumped on every open, so the form remounts with fresh answers. */
  key: number;
}

/**
 * The schedule (from DentalOS's schedule page, without the online-booking queue):
 * a week calendar under the page title, with a popover beside whichever
 * appointment is clicked. Fills the space under the app header; only the
 * calendar grid scrolls.
 */
export default function AppointmentsPage() {
  const [creating, setCreating] = useState<CreateDefaults | null>(null);
  const [selected, setSelected] = useState<{ id: string; anchor: DOMRect } | null>(null);
  const [filter, setFilter] = useState<ScheduleFilter>(DEFAULT_FILTER);

  const openCreate = (defaults: Omit<CreateDefaults, "key">) => setCreating({ ...defaults, key: Date.now() });
  const closePopover = useCallback(() => setSelected(null), []);
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
          <PatientSearch className="flex-1 min-w-0 sm:flex-none sm:w-60" placeholder="Search patients…" />
          <AppointmentFilter value={filter} onChange={setFilter} />
          <button
            className="btn btn-primary shrink-0"
            onClick={() => openCreate({ date: manilaToday(), startTime: "09:00", endTime: "09:30" })}
            aria-label="New Appointment"
          >
            <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
            <span className="hidden sm:inline">New Appointment</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-[480px]">
        <ScheduleCalendar
          selectedId={selected?.id ?? null}
          onSelect={(id, anchor) => setSelected({ id, anchor })}
          filter={visible}
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
        />
      )}
    </div>
  );
}
