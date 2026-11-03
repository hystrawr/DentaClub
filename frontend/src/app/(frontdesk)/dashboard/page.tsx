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
 * From 1024px wide it fits the screen exactly, like the other pages: the bottom
 * card takes the height that is left, and a long day's appointment list (or a
 * calendar on a short window) scrolls inside it, so the page itself never does.
 * On smaller screens the cards stack and the page scrolls as usual.
 */
export default function DashboardPage() {
  const today = manilaToday();
  const [selected, setSelected] = useState(today);
  const user = useCurrentUser();
  const todays = useAppointments({ date: today });

  const appointments = todays.data ?? [];

  return (
    <div className="flex flex-col px-5 sm:px-10 lg:px-12 py-6 lg:h-full">
      <h1 className="text-6xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
        {greeting(manilaHour())}
        {user.data?.username ? `, ${user.data.username}` : ""}!
      </h1>
      <p className="mt-1 mb-5 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
        {longDate(today)}
      </p>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:flex-1 lg:min-h-0 lg:grid-rows-[auto_minmax(0,1fr)]">
        <PatientsTodayCard appointments={appointments} isLoading={todays.isLoading} />
        <RecentVisitsCard />

        <section className="card-premium lg:col-span-2 grid md:grid-cols-[minmax(280px,360px)_1fr] lg:grid-rows-[minmax(0,1fr)] lg:min-h-0 overflow-hidden">
          <div
            className="p-5 border-b md:border-b-0 md:border-r min-h-0 lg:overflow-y-auto"
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
