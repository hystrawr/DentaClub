"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { useAppointments } from "@/lib/api/appointments";
import { styleFor } from "@/lib/utils/appointment-status";
import { planDay, TITLE, type DayRow } from "@/lib/utils/day-list";
import { manilaMinutes, manilaToday, shortDate, timeOf } from "@/lib/utils/manila";
import { NewAppointmentModal } from "@/components/schedule/NewAppointmentModal";
import { AppointmentRow } from "./AppointmentRow";
import { AppointmentSheet } from "./AppointmentSheet";

/** Rows the card shows before the list scrolls. */
const VISIBLE_ROWS = 4;

/** Minutes since midnight on the clinic's clock, ticking each minute so Late and Next stay true. */
function useNowMinutes(): number {
  const [now, setNow] = useState(manilaMinutes);
  useEffect(() => {
    const timer = setInterval(() => setNow(manilaMinutes()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/**
 * The appointments on the date picked in the calendar, earliest first, titled
 * for the day: today's, tomorrow's, upcoming or past (see lib/utils/day-list).
 *
 * Today tags each patient (Next, Late, Arrived, In chair) and folds the ones
 * already seen under the list. A past day keeps every booking, with how it
 * ended. An empty day today or later offers to book one.
 */
export function UpcomingAppointments({ date }: { date: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [booking, setBooking] = useState<number | null>(null);
  const { data, isLoading, isError } = useAppointments({ date });
  const listRef = useRef<HTMLUListElement>(null);
  const [maxHeight, setMaxHeight] = useState<number>();
  /** The list has rows out of view, so the "Scroll for more" hint shows. */
  const [overflows, setOverflows] = useState(false);

  const today = manilaToday();
  const now = useNowMinutes();
  const plan = planDay(data ?? [], date, today, now);
  const shown: DayRow[] = showCompleted ? [...plan.rows, ...plan.completed] : plan.rows;
  const canBook = plan.kind !== "past";

  // Cap the list at exactly VISIBLE_ROWS rows, measured rather than guessed:
  // on narrow screens a row wraps and gets taller. When the window is too short
  // for that many, the list shrinks with the card and scrolls sooner.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const fit = () => {
      const last = list.children[VISIBLE_ROWS - 1] as HTMLElement | undefined;
      // From VISIBLE_ROWS rows on, the height is always the same measurement, so
      // showing or hiding completed rows never nudges what sits below the list.
      // Measured to the fraction of a pixel: rounding here showed as a 1px jump.
      setMaxHeight(
        list.children.length >= VISIBLE_ROWS && last
          ? last.getBoundingClientRect().bottom - list.getBoundingClientRect().top + list.scrollTop
          : undefined,
      );
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(list);
    return () => observer.disconnect();
  }, [shown.length, isLoading, isError]);

  // The hint follows what is really out of view, not a row count: on a short
  // window even four rows can overflow the card, completed ones shown or not.
  useLayoutEffect(() => {
    const list = listRef.current;
    const check = () => setOverflows(Boolean(list && list.scrollHeight > list.clientHeight + 1));
    check();
    if (!list) return;
    const observer = new ResizeObserver(check);
    observer.observe(list);
    return () => observer.disconnect();
  }, [shown.length, maxHeight, isLoading, isError]);

  const empty =
    plan.kind === "today"
      ? plan.bookedAny
        ? "No more appointments today."
        : "No appointments today."
      : plan.kind === "past"
        ? "No appointments on this day."
        : "No appointments booked for this day.";

  return (
    <div className="flex flex-col p-5 min-w-0 min-h-0">
      <div className="flex items-center gap-2.5 mb-3 flex-wrap shrink-0">
        <h2 className="text-[17px] font-bold" style={{ color: "var(--color-foreground)" }}>
          {TITLE[plan.kind]}
        </h2>
        {!isLoading && !isError && (
          <span
            className="rounded-full px-2 text-xs font-semibold tabular-nums leading-5"
            style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
            aria-label={`${plan.rows.length} appointment${plan.rows.length === 1 ? "" : "s"}`}
          >
            {plan.rows.length}
          </span>
        )}
        {/* Today needs no date: the title says it. */}
        {plan.kind !== "today" && (
          <span className="text-[13px]" style={{ color: "var(--color-muted-foreground)" }}>
            {shortDate(date, true)}
          </span>
        )}
        {overflows && (
          <span className="ml-auto text-[11px]" style={{ color: "var(--color-subtle-foreground)" }}>
            Scroll for more
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
      ) : (
        <>
          {plan.rows.length === 0 && (
            <div
              className="flex flex-col items-center gap-3 rounded-2xl py-7 text-center text-sm shrink-0"
              style={{ border: "2px dashed var(--color-border)", color: "var(--color-subtle-foreground)" }}
            >
              {empty}
              {canBook && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setBooking(Date.now())}>
                  <Plus size={14} aria-hidden="true" /> Book appointment
                </button>
              )}
            </div>
          )}

          {shown.length > 0 && (
            <ul
              ref={listRef}
              className="relative min-h-0 space-y-2.5 overflow-y-auto"
              // The scrollbar's room is always kept, so rows keep one width whether the list scrolls or not.
              style={{ maxHeight, paddingRight: 6, scrollbarGutter: "stable", marginTop: plan.rows.length === 0 ? 10 : 0 }}
            >
              {shown.map(({ appointment: a, tag }) => (
                <AppointmentRow
                  key={a.id}
                  patientName={a.patient?.full_name ?? "Blocked time"}
                  appointmentType={a.appointment_type?.name ?? null}
                  start={timeOf(a.scheduled_start)}
                  end={timeOf(a.scheduled_end)}
                  color={a.appointment_type?.color_hex ?? styleFor(a.status).dot}
                  onView={() => setSelected(a.id)}
                  tag={tag}
                  muted={tag === "completed" || tag === "no_show" || tag === "cancelled"}
                />
              ))}
            </ul>
          )}

          {/* Today's patients already seen, out of the way until asked for. */}
          {plan.completed.length > 0 && (
            <button
              type="button"
              className="mt-2.5 self-start shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold hover:bg-surface-subtle"
              style={{ color: "var(--color-muted-foreground)" }}
              aria-expanded={showCompleted}
              onClick={() => setShowCompleted((v) => !v)}
            >
              {plan.completed.length} completed · {showCompleted ? "Hide" : "Show"}
              <ChevronDown
                size={14}
                aria-hidden="true"
                style={{ transform: showCompleted ? "rotate(180deg)" : undefined, transition: "transform 150ms ease" }}
              />
            </button>
          )}
        </>
      )}

      {selected && <AppointmentSheet key={selected} appointmentId={selected} onClose={() => setSelected(null)} />}
      {booking !== null && <NewAppointmentModal key={booking} defaultDate={date} onClose={() => setBooking(null)} />}
    </div>
  );
}
