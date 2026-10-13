"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/api/auth";
import { useAppointments } from "@/lib/api/appointments";
import { longDate, manilaHour, manilaToday } from "@/lib/utils/manila";
import { AppointmentCalendar } from "@/components/dashboard/AppointmentCalendar";
import { PatientsTodayCard } from "@/components/dashboard/PatientsTodayCard";
import { RecentVisitsCard } from "@/components/dashboard/RecentVisitsCard";
import { UpcomingAppointments } from "@/components/dashboard/UpcomingAppointments";

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The front-desk dashboard: today's patients, recent visits and upcoming appointments.
 *
 * On desktop it fills exactly the space under the app header — the bottom card
 * takes whatever height is left, and only the appointment list inside it scrolls.
 * On small screens the cards stack and the page scrolls as usual.
 */
export default function DashboardPage() {
  const today = manilaToday();
  const [selected, setSelected] = useState(today);
  const user = useCurrentUser();
  const todays = useAppointments({ date: today });

  const appointments = todays.data ?? [];
  const left = appointments.filter((a) => ["scheduled", "confirmed", "arrived", "in_chair"].includes(a.status)).length;

  return (
    <div className="flex flex-col px-4 sm:px-8 py-6 max-w-400lg:h-full">
      <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-foreground)" }}>
        {greeting(manilaHour())}
        {user.data?.username && (
          <>
            , <span style={{ color: "var(--color-primary)" }}>{user.data.username}</span>
          </>
        )}
        !
      </h1>
      <p className="mt-1 mb-5 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
        {longDate(today)}
        {!todays.isLoading &&
          ` · ${left === 0 ? "No more appointments today." : `You have ${left} appointment${left === 1 ? "" : "s"} left today.`}`}
      </p>

      <div className="grid gap-4 lg:flex-1 lg:min-h-0 lg:grid-cols-[260px_1fr] lg:grid-rows-[auto_minmax(0,1fr)]">
        <PatientsTodayCard appointments={appointments} isLoading={todays.isLoading} />
        <RecentVisitsCard />

        <section className="card-premium lg:col-span-2 lg:min-h-0 grid md:grid-cols-[minmax(280px,360px)_1fr] md:grid-rows-[minmax(0,1fr)] overflow-hidden">
          <div
            className="p-5 border-b md:border-b-0 md:border-r min-h-0"
            style={{ borderColor: "var(--color-border)" }}
          >
            <AppointmentCalendar today={today} selected={selected} onSelect={setSelected} />
          </div>
          <UpcomingAppointments date={selected} />
        </section>
      </div>
    </div>
  );
}
