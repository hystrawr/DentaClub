"use client";

import { useState } from "react";
import { TopHeader } from "@/components/frontdesk/TopHeader";
import { AppointmentDetailPanel } from "@/components/schedule/AppointmentDetailPanel";
import { NewAppointmentModal } from "@/components/schedule/NewAppointmentModal";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { manilaToday } from "@/lib/utils/manila";

interface CreateDefaults {
  date: string;
  startTime: string;
  endTime: string;
  /** Bumped on every open, so the form remounts with fresh answers. */
  key: number;
}

/** The schedule (from DentalOS's schedule page, without the online-booking queue). */
export default function SchedulePage() {
  const [creating, setCreating] = useState<CreateDefaults | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openCreate = (defaults: Omit<CreateDefaults, "key">) => setCreating({ ...defaults, key: Date.now() });

  return (
    <div className="flex flex-col" style={{ height: "100vh" }}>
      <TopHeader
        title="Schedule"
        subtitle="Appointments & availability"
        ctaLabel="New Appointment"
        onCta={() => openCreate({ date: manilaToday(), startTime: "09:00", endTime: "09:30" })}
      />

      <div className="flex-1 p-6 overflow-hidden">
        <ScheduleCalendar onSelect={setSelectedId} onCreate={openCreate} />
      </div>

      {creating && (
        <NewAppointmentModal
          key={creating.key}
          onClose={() => setCreating(null)}
          defaultDate={creating.date}
          defaultStartTime={creating.startTime}
          defaultEndTime={creating.endTime}
        />
      )}
      <AppointmentDetailPanel appointmentId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
