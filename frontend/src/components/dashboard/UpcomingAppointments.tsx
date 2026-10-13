"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useAppointments } from "@/lib/api/appointments";
import { styleFor } from "@/lib/utils/appointment-status";
import { manilaToday, shortDate, timeOf } from "@/lib/utils/manila";
import type { AppointmentStatus } from "@/types/api";
import { AppointmentRow } from "./AppointmentRow";
import { AppointmentSheet } from "./AppointmentSheet";

/** Statuses that will not take up a chair, so they never show as upcoming. */
const OFF_THE_BOOKS: AppointmentStatus[] = ["cancelled", "no_show"];

/** Rows the card shows before the list scrolls. */
const VISIBLE_ROWS = 4;

/**
 * The appointments on the date picked in the calendar, earliest first.
 * For today, patients already seen drop off — what is left is what is coming.
 */
export function UpcomingAppointments({ date }: { date: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { data, isLoading, isError } = useAppointments({ date });
  const listRef = useRef<HTMLUListElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  const today = manilaToday();
  const items = (data ?? []).filter(
    (a) => !OFF_THE_BOOKS.includes(a.status) && !(date === today && a.status === "completed"),
  );

  // Cap the list at exactly VISIBLE_ROWS rows, measured rather than guessed:
  // on narrow screens a row wraps and gets taller. When the window is too short
  // for that many, the list shrinks with the card and scrolls sooner.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const fit = () => {
      const last = list.children[VISIBLE_ROWS - 1] as HTMLElement | undefined;
      setMaxHeight(list.children.length > VISIBLE_ROWS && last ? last.offsetTop + last.offsetHeight : undefined);
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items.length, isLoading, isError]);

  return (
    <div className="flex flex-col p-5 min-w-0 min-h-0">
      <div className="flex items-baseline gap-2.5 mb-3 flex-wrap shrink-0">
        <h2 className="text-[17px] font-bold" style={{ color: "var(--color-foreground)" }}>
          {date < today ? "Appointments" : "Upcoming Appointments"}
        </h2>
        <span className="text-[13px] font-mono" style={{ color: "var(--color-muted-foreground)" }}>
          {shortDate(date, true)}
        </span>
        {items.length > VISIBLE_ROWS && (
          <span className="ml-auto text-[11px]" style={{ color: "var(--color-subtle-foreground)" }}>
            {items.length} appointments · scroll for more
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2.5" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 62 }} />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
          Appointments could not be loaded. Check that the backend is running.
        </p>
      ) : items.length === 0 ? (
        <p
          className="rounded-2xl py-8 text-center text-sm"
          style={{ border: "2px dashed var(--color-border)", color: "var(--color-subtle-foreground)" }}
        >
          {date === today ? "No more appointments today." : "No appointments on this day."}
        </p>
      ) : (
        <ul
          ref={listRef}
          className="relative min-h-0 space-y-2.5 overflow-y-auto"
          style={{ maxHeight, paddingRight: maxHeight ? 6 : undefined }}
        >
          {items.map((a) => (
            <AppointmentRow
              key={a.id}
              patientName={a.patient?.full_name ?? "Blocked time"}
              appointmentType={a.appointment_type?.name ?? null}
              start={timeOf(a.scheduled_start)}
              end={timeOf(a.scheduled_end)}
              color={a.appointment_type?.color_hex ?? styleFor(a.status).dot}
              onView={() => setSelected(a.id)}
            />
          ))}
        </ul>
      )}

      {selected && <AppointmentSheet key={selected} appointmentId={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
