"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAppointments } from "@/lib/api/appointments";
import { styleFor } from "@/lib/utils/appointment-status";
import { addDays, dateOf, longDate, manilaToday, minutesOf, shortDate, timeOf, weekOf, weekdayOf } from "@/lib/utils/manila";
import type { Appointment } from "@/types/api";

/**
 * The schedule calendar, ported from DentalOS's ScheduleCalendar: day and week
 * views, appointment blocks coloured by status, and drag-to-create.
 *
 * Changed from DentalOS:
 *  - **Clinic time throughout.** Blocks are placed from the API's `+08:00`
 *    timestamps and dates are Manila dates. DentalOS used the browser clock and
 *    `toISOString()` (UTC), so before 08:00 Manila "today" was yesterday.
 *  - **Minute-accurate placement.** DentalOS rounded every start to :00/:30, so
 *    a 9:15 cleaning drew at 9:00 and overlapped whatever was there.
 *  - Online booking requests are left out (not ported).
 */

type CalendarView = "day" | "week";

const HOUR_START = 7;
const HOUR_END = 19;
const SLOT_H = 32; // px per 30 minutes
const PX_PER_MIN = SLOT_H / 30;
const TIME_COL_W = 56;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const totalHeight = () => (HOUR_END - HOUR_START) * 2 * SLOT_H;

function slotToTime(slot: number): string {
  const h = HOUR_START + Math.floor(slot / 2);
  const m = (slot % 2) * 30;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const yToSlot = (offsetY: number) => Math.max(0, Math.min(Math.floor(offsetY / SLOT_H), (HOUR_END - HOUR_START) * 2 - 1));

/* ─── Overlap layout ────────────────────────────────────────────── */

/**
 * Side-by-side lanes for overlapping appointments.
 *
 * DentalOS drew every block at full width, so two dentists working at the same
 * hour put one appointment on top of the other and the lower one could not be
 * clicked. Overlapping appointments form a cluster; each takes the first free
 * lane, and every block in the cluster gets `1 / lanes` of the width.
 */
export function layoutLanes(appointments: Appointment[]): Map<string, { lane: number; lanes: number }> {
  const sorted = [...appointments].sort(
    (a, b) => minutesOf(a.scheduled_start) - minutesOf(b.scheduled_start) || minutesOf(b.scheduled_end) - minutesOf(a.scheduled_end),
  );
  const result = new Map<string, { lane: number; lanes: number }>();
  let cluster: Array<{ id: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const item of cluster) result.set(item.id, { lane: item.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
  };

  for (const apt of sorted) {
    const start = minutesOf(apt.scheduled_start);
    const end = minutesOf(apt.scheduled_end);
    if (start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ id: apt.id, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return result;
}

/* ─── Appointment block ─────────────────────────────────────────── */

function ApptBlock({
  apt,
  lane = 0,
  lanes = 1,
  onSelect,
}: {
  apt: Appointment;
  lane?: number;
  lanes?: number;
  onSelect: (id: string) => void;
}) {
  const start = minutesOf(apt.scheduled_start);
  const end = minutesOf(apt.scheduled_end);
  const top = (start - HOUR_START * 60) * PX_PER_MIN;
  const height = Math.max((end - start) * PX_PER_MIN - 2, 18);
  const colors = styleFor(apt.status);
  const tall = height >= 60;
  const released = apt.status === "cancelled" || apt.status === "no_show";
  const name = apt.patient?.full_name ?? apt.appointment_type?.name ?? "Blocked";

  return (
    <div
      data-appt-block="1"
      className="absolute rounded-xl px-2 py-1 cursor-pointer overflow-hidden transition-all duration-150 hover:brightness-95 hover:shadow-sm"
      style={{
        top,
        height,
        left: `calc(${(lane / lanes) * 100}% + 4px)`,
        width: `calc(${100 / lanes}% - 6px)`,
        background: apt.patient ? colors.bg : "repeating-linear-gradient(45deg,#F1F5F9,#F1F5F9 6px,#E2E8F0 6px,#E2E8F0 12px)",
        border: `1.5px solid ${apt.patient ? colors.border : "#CBD5E1"}`,
        opacity: released ? 0.55 : 1,
      }}
      role="button"
      tabIndex={0}
      aria-label={`${name} — ${apt.appointment_type?.name ?? "appointment"} at ${timeOf(apt.scheduled_start)}, ${colors.label}`}
      onClick={() => onSelect(apt.id)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(apt.id)}
    >
      <div className="flex items-center gap-1">
        <span className="text-xs font-bold tabular-nums leading-none" style={{ color: colors.text }}>
          {timeOf(apt.scheduled_start)}
        </span>
        <span className="rounded-full shrink-0 ml-auto" style={{ width: 6, height: 6, background: colors.dot }} aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold leading-tight truncate" style={{ color: colors.text, textDecoration: released ? "line-through" : undefined }}>
        {name}
      </p>
      {tall && apt.appointment_type && apt.patient && (
        <p className="text-xs leading-tight truncate mt-0.5" style={{ color: colors.text, opacity: 0.75 }}>
          {apt.appointment_type.name}
        </p>
      )}
      {height >= 90 && apt.provider && (
        <p className="text-xs leading-tight truncate mt-0.5" style={{ color: colors.text, opacity: 0.6 }}>
          {apt.provider.name}
          {apt.operatory ? ` · ${apt.operatory.name}` : ""}
        </p>
      )}
    </div>
  );
}

/* ─── Day column (with drag-to-create) ─────────────────────────── */

interface DragState {
  dateKey: string;
  startSlot: number;
  currentSlot: number;
}

function DayColumn({
  dateKey,
  appointments,
  onSelect,
  onDragEnd,
}: {
  dateKey: string;
  appointments: Appointment[];
  onSelect: (id: string) => void;
  onDragEnd: (drag: DragState) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const lanes = layoutLanes(appointments);

  const getSlot = useCallback((e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? yToSlot(e.clientY - rect.top) : 0;
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest("[data-appt-block]")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const slot = getSlot(e);
    dragRef.current = { dateKey, startSlot: slot, currentSlot: slot };
    setDrag(dragRef.current);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    dragRef.current = { ...dragRef.current, currentSlot: getSlot(e) };
    setDrag(dragRef.current);
  }

  function onPointerUp() {
    const committed = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!committed) return;
    const lo = Math.min(committed.startSlot, committed.currentSlot);
    const hi = Math.max(committed.startSlot, committed.currentSlot);
    // A plain click is not a booking; at least one slot of drag opens the form.
    if (hi > lo) onDragEnd({ ...committed, startSlot: lo, currentSlot: hi });
  }

  const ghost = drag
    ? (() => {
        const lo = Math.min(drag.startSlot, drag.currentSlot);
        const hi = Math.max(drag.startSlot, drag.currentSlot);
        return { top: lo * SLOT_H, height: (hi - lo + 1) * SLOT_H - 2, label: `${slotToTime(lo)} – ${slotToTime(hi + 1)}` };
      })()
    : null;

  return (
    <div
      ref={ref}
      className="flex-1 relative select-none"
      style={{ borderLeft: "1px solid var(--color-border)", cursor: "crosshair", minWidth: 0 }}
      data-date={dateKey}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        dragRef.current = null;
        setDrag(null);
      }}
    >
      {Array.from({ length: (HOUR_END - HOUR_START) * 2 }, (_, s) => (
        <div
          key={s}
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: s * SLOT_H, height: SLOT_H, borderBottom: s % 2 === 1 ? "1px solid var(--color-border)" : "1px dashed #E8EDF3" }}
        />
      ))}

      {appointments.map((apt) => (
        <ApptBlock key={apt.id} apt={apt} {...lanes.get(apt.id)} onSelect={onSelect} />
      ))}

      {ghost && (
        <div
          className="absolute left-1 right-1 rounded-xl px-2 py-1 pointer-events-none"
          style={{ top: ghost.top, height: ghost.height, background: "rgba(37,99,235,0.12)", border: "1.5px solid #93C5FD", zIndex: 10 }}
          aria-hidden="true"
        >
          <span className="text-xs font-bold tabular-nums" style={{ color: "#1D4ED8" }}>
            {ghost.label}
          </span>
        </div>
      )}
    </div>
  );
}

function TimeGutter() {
  return (
    <div className="shrink-0" style={{ width: TIME_COL_W }}>
      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
        const h = HOUR_START + i;
        const label = h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
        return (
          <div key={h} className="flex items-start justify-end pr-3" style={{ height: SLOT_H * 2 }}>
            <span className="text-xs" style={{ color: "var(--color-subtle-foreground)", marginTop: -7 }}>
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────── */

export function ScheduleCalendar({
  onSelect,
  onCreate,
}: {
  onSelect: (appointmentId: string) => void;
  onCreate: (defaults: { date: string; startTime: string; endTime: string }) => void;
}) {
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(manilaToday);
  const today = manilaToday();

  const week = weekOf(anchor);
  const visibleDates = view === "week" ? week : [anchor];

  const { data: appointments, isLoading, isError } = useAppointments(
    view === "week" ? { date_from: week[0], date_to: week[6] } : { date: anchor },
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments ?? []) {
      const key = dateOf(apt.scheduled_start);
      map.set(key, [...(map.get(key) ?? []), apt]);
    }
    return map;
  }, [appointments]);

  const step = view === "week" ? 7 : 1;
  const headerLabel =
    view === "week" ? `${shortDate(week[0]!)} – ${shortDate(week[6]!, true)}` : longDate(anchor);

  return (
    <div className="card-premium flex flex-col" style={{ height: "100%", overflow: "hidden" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <button
          onClick={() => setAnchor(addDays(anchor, -step))}
          className="flex items-center justify-center rounded-full transition-colors hover:bg-slate-100"
          style={{ width: 30, height: 30, border: "1px solid var(--color-border)" }}
          aria-label="Previous"
        >
          <ChevronLeft size={14} style={{ color: "var(--color-muted-foreground)" }} />
        </button>
        <button
          onClick={() => setAnchor(addDays(anchor, step))}
          className="flex items-center justify-center rounded-full transition-colors hover:bg-slate-100"
          style={{ width: 30, height: 30, border: "1px solid var(--color-border)" }}
          aria-label="Next"
        >
          <ChevronRight size={14} style={{ color: "var(--color-muted-foreground)" }} />
        </button>

        <span className="text-sm font-semibold flex-1" style={{ color: "var(--color-foreground)" }}>
          {headerLabel}
        </span>

        {isLoading && (
          <div className="w-4 h-4 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} aria-hidden="true" />
        )}
        {isError && (
          <span className="text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
            Could not load appointments
          </span>
        )}

        <button
          onClick={() => setAnchor(manilaToday())}
          className="px-3 py-1 text-xs font-semibold rounded-full transition-colors hover:bg-slate-100"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)" }}
        >
          Today
        </button>

        <div className="flex rounded-full overflow-hidden" style={{ border: "1px solid var(--color-border)" }} role="group" aria-label="Calendar view">
          {(["day", "week"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("px-3 py-1 text-xs font-semibold capitalize transition-colors", view === v ? "bg-blue-600 text-white" : "hover:bg-slate-50")}
              style={view !== v ? { color: "var(--color-muted-foreground)" } : {}}
              aria-pressed={view === v}
            >
              {v}
            </button>
          ))}
        </div>

        <button
          className="btn-gradient flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          aria-label="New appointment"
          onClick={() => onCreate({ date: anchor, startTime: "09:00", endTime: "09:30" })}
        >
          <Plus size={12} strokeWidth={2.5} /> New
        </button>
      </div>

      {/* Day header */}
      <div className="flex shrink-0" style={{ paddingLeft: TIME_COL_W, borderBottom: "1px solid var(--color-border)" }}>
        {visibleDates.map((date, i) => {
          const isToday = date === today;
          return (
            <button
              type="button"
              key={date}
              onClick={() => {
                setAnchor(date);
                setView("day");
              }}
              className="flex-1 flex flex-col items-center py-2 hover:bg-slate-50"
              style={{ borderLeft: i > 0 ? "1px solid var(--color-border)" : undefined }}
              aria-label={`Open ${longDate(date)}`}
            >
              <span
                className="text-xs uppercase tracking-wider"
                style={{ color: isToday ? "var(--color-primary)" : "var(--color-subtle-foreground)", fontWeight: isToday ? 700 : 500 }}
              >
                {DOW[weekdayOf(date)]}
              </span>
              <span
                className={cn("text-sm font-bold mt-0.5 w-7 h-7 flex items-center justify-center rounded-full", isToday ? "text-white" : "")}
                style={isToday ? { background: "var(--color-primary)" } : { color: "var(--color-foreground)" }}
              >
                {Number(date.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex" style={{ height: totalHeight() }}>
          <TimeGutter />
          {visibleDates.map((date) => (
            <DayColumn
              key={date}
              dateKey={date}
              appointments={byDate.get(date) ?? []}
              onSelect={onSelect}
              onDragEnd={(drag) =>
                onCreate({ date: drag.dateKey, startTime: slotToTime(drag.startSlot), endTime: slotToTime(drag.currentSlot + 1) })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
