"use client";

import Link from "next/link";
import type { Route } from "next";
import { useAppointments } from "@/lib/api/appointments";
import { addDays, clock, dateOf, manilaToday, shortDate, timeOf } from "@/lib/utils/manila";
import { PatientAvatar } from "./AppointmentRow";

/** How far back "recent" reaches, and how many visits the card lists. */
const LOOKBACK_DAYS = 90;
const SHOWN = 2;

/** The latest completed visits, newest first; each row opens the patient's record. */
export function RecentVisitsCard() {
  const today = manilaToday();
  const { data, isLoading, isError } = useAppointments({
    status: "completed",
    date_from: addDays(today, -LOOKBACK_DAYS),
    date_to: today,
  });
  const visits = (data ?? []).filter((a) => a.patient).reverse().slice(0, SHOWN);

  return (
    <section className="card-premium min-w-0 pb-2">
      <div className="flex items-center justify-between px-5 sm:px-6 pt-4 pb-2.5">
        <h2 className="text-[15px] font-bold" style={{ color: "var(--color-foreground)" }}>
          Recent Patient Visits
        </h2>
        <Link href="/appointments" className="text-xs font-semibold hover:underline" style={{ color: "var(--color-primary)" }}>
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 px-5 sm:px-6 pb-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 48 }} />
          ))}
        </div>
      ) : isError ? (
        <p className="px-5 sm:px-6 pb-3 text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
          Recent visits could not be loaded.
        </p>
      ) : visits.length === 0 ? (
        <p className="px-5 sm:px-6 pb-4 text-sm" style={{ color: "var(--color-subtle-foreground)" }}>
          No completed visits in the last {LOOKBACK_DAYS} days.
        </p>
      ) : (
        <ul>
          {visits.map((a) => (
            <li key={a.id} style={{ borderTop: "1px solid var(--color-border)" }}>
              <Link
                href={`/patients/${a.patient!.id}` as Route}
                className="table-row-hover flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 sm:px-6 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <PatientAvatar name={a.patient!.full_name} color={a.provider?.color_hex} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-foreground)" }}>
                      {a.patient!.full_name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--color-subtle-foreground)" }}>
                      Patient
                    </p>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {shortDate(dateOf(a.scheduled_start), true)} · {clock(timeOf(a.scheduled_start))} –{" "}
                    {clock(timeOf(a.scheduled_end))}
                  </p>
                  {a.provider && (
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--color-subtle-foreground)" }}>
                      {a.provider.name}
                    </p>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
