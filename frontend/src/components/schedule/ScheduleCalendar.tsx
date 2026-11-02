"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAppointments } from "@/lib/api/appointments";
import { appointmentColor, initialsOf, styleFor, tint } from "@/lib/utils/appointment-status";
import {
  addDays,
  clock,
  dateOf,
  longDate,
  manilaMinutes,
  manilaToday,
  minutesOf,
  monthYear,
  timeOf,
  weekOf,
  weekdayOf,
} from "@/lib/utils/manila";
import type { Appointment } from "@/types/api";
import { DatePickerPopover } from "./DatePickerPopover";

/**
 * The schedule calendar, ported from DentalOS's ScheduleCalendar: day and week
 * views and appointment cards.
 *
 * Changed from DentalOS:
 *  - **Clinic time throughout.** Blocks are placed from the API's `+08:00`
 *    timestamps and dates are Manila dates. DentalOS used the browser clock and
 *    `toISOString()` (UTC), so before 08:00 Manila "today" was yesterday.
 *  - **Minute-accurate placement.** DentalOS rounded every start to :00/:30, so
 *    a 9:15 cleaning drew at 9:00 and overlapped whatever was there.
 *  - Cards are tinted by procedure; the status is the dot in the corner.
 *  - Online booking requests are left out (not ported).
 */

type CalendarView = "day" | "week";

const HOUR_START = 7;
const HOUR_END = 19;
const SLOT_H = 48; // px per 30 minutes
const PX_PER_MIN = SLOT_H / 30;
const TIME_COL_W = 72;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The statuses shown in the toolbar key — the ones a receptionist acts on. */
const LEGEND = (["scheduled", "confirmed", "in_chair", "completed"] as const).map(styleFor);

const totalHeight = () => (HOUR_END - HOUR_START) * 2 * SLOT_H;

/** Where "now" sits on the grid, or null outside clinic hours. Re-reads every minute. */
function useNowOffset(): number | null {
  const [minutes, setMinutes] = useState(manilaMinutes);
  useEffect(() => {
    const timer = setInterval(() => setMinutes(manilaMinutes()), 60_000);
    return () => clearInterval(timer);
  }, []);
  if (minutes < HOUR_START * 60 || minutes >= HOUR_END * 60) return null;
  return (minutes - HOUR_START * 60) * PX_PER_MIN;
}

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

/* ─── Appointment card ──────────────────────────────────────────── */

function Avatar({ label, color, size = 22, ring = false }: { label: string; color: string; size?: number; ring?: boolean }) {
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0 font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42, border: ring ? "2px solid #fff" : undefined }}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

function ApptBlock({
  apt,
  lane = 0,
  lanes = 1,
  selected,
  onSelect,
}: {
  apt: Appointment;
  lane?: number;
  lanes?: number;
  selected: boolean;
  onSelect: (id: string, anchor: DOMRect) => void;
}) {
  const start = minutesOf(apt.scheduled_start);
  const end = minutesOf(apt.scheduled_end);
  const top = (start - HOUR_START * 60) * PX_PER_MIN;
  const height = Math.max((end - start) * PX_PER_MIN - 4, 22);
  const status = styleFor(apt.status);
  const color = appointmentColor(apt);
  const released = apt.status === "cancelled" || apt.status === "no_show";
  const name = apt.patient?.full_name ?? "Blocked time";
  const range = `${clock(timeOf(apt.scheduled_start))} – ${clock(timeOf(apt.scheduled_end))}`;
  const roomy = height >= 88;
  const medium = height >= 56;

  return (
    <div
      data-appt-block="1"
      className={cn(
        "absolute rounded-xl cursor-pointer overflow-hidden flex flex-col transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-md",
        roomy ? "px-2.5 py-2 gap-0.5" : "px-2 py-1",
      )}
      style={{
        top: top + 2,
        height,
        left: `calc(${(lane / lanes) * 100}% + 4px)`,
        width: `calc(${100 / lanes}% - 8px)`,
        background: apt.patient
          ? tint(color, 9)
          : "repeating-linear-gradient(45deg,#F2F4DC,#F2F4DC 6px,#E4E6CF 6px,#E4E6CF 12px)",
        border: `1px solid ${apt.patient ? tint(color, 30) : "var(--color-border-strong)"}`,
        outline: selected ? "2px solid var(--color-primary)" : undefined,
        outlineOffset: 1,
        opacity: released ? 0.5 : 1,
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${name} — ${apt.appointment_type?.name ?? "appointment"}, ${range}, ${status.label}`}
      onClick={(e) => onSelect(apt.id, e.currentTarget.getBoundingClientRect())}
      onKeyDown={(e) => e.key === "Enter" && onSelect(apt.id, e.currentTarget.getBoundingClientRect())}
    >
      <span
        className="absolute rounded-full"
        style={{ top: 9, right: 9, width: 7, height: 7, background: status.dot }}
        title={status.label}
        aria-hidden="true"
      />

      <div className="flex items-center gap-1.5 min-w-0 pr-3">
        {medium && apt.patient && <Avatar label={initialsOf(name)} color={color} />}
        <span
          className="text-xs font-bold truncate"
          style={{ color: "var(--color-foreground)", textDecoration: released ? "line-through" : undefined }}
        >
          {name}
        </span>
        {!medium && (
          <span className="text-[11px] tabular-nums shrink-0" style={{ color: "var(--color-muted-foreground)" }}>
            {clock(timeOf(apt.scheduled_start))}
          </span>
        )}
      </div>

      {medium && apt.appointment_type && (
        <p className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
          {apt.appointment_type.name}
        </p>
      )}

      {roomy && (
        <div className="mt-auto flex items-center justify-between gap-1.5">
          <span className="text-[11px] tabular-nums truncate" style={{ color: "var(--color-muted-foreground)" }}>
            {range}
          </span>
          {apt.provider && (
            <span title={apt.provider.name}>
              <Avatar label={initialsOf(apt.provider.name)} color={apt.provider.color_hex} size={20} ring />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Day column ───────────────────────────────────────────────── */

function DayColumn({
  dateKey,
  isToday,
  nowOffset,
  appointments,
  selectedId,
  onSelect,
}: {
  dateKey: string;
  isToday: boolean;
  nowOffset: number | null;
  appointments: Appointment[];
  selectedId: string | null;
  onSelect: (id: string, anchor: DOMRect) => void;
}) {
  const lanes = layoutLanes(appointments);

  return (
    <div
      className="flex-1 relative"
      style={{
        borderLeft: "1px solid var(--color-border)",
        minWidth: 0,
        background: isToday ? "rgb(66 74 31 / 0.04)" : undefined,
        backgroundImage: "linear-gradient(var(--color-border) 1px, transparent 1px)",
        backgroundSize: `100% ${SLOT_H * 2}px`,
      }}
      data-date={dateKey}
    >
      {appointments.map((apt) => (
        <ApptBlock key={apt.id} apt={apt} {...lanes.get(apt.id)} selected={apt.id === selectedId} onSelect={onSelect} />
      ))}

      {isToday && nowOffset !== null && (
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: nowOffset, borderTop: "1.5px dashed var(--color-primary)", zIndex: 3 }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function TimeGutter({ nowOffset, showNow }: { nowOffset: number | null; showNow: boolean }) {
  const now = manilaMinutes();
  return (
    <div className="shrink-0 relative" style={{ width: TIME_COL_W }}>
      {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => {
        const h = HOUR_START + i;
        const label = h === 12 ? "12 PM" : h < 12 ? `${h} AM` : `${h - 12} PM`;
        return (
          <div key={h} className="flex items-start justify-end pr-3" style={{ height: SLOT_H * 2 }}>
            <span className="text-[11px]" style={{ color: "var(--color-subtle-foreground)", marginTop: -8 }}>
              {label}
            </span>
          </div>
        );
      })}
      {showNow && nowOffset !== null && (
        <span
          className="absolute right-2 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums text-white"
          style={{ top: nowOffset - 10, background: "var(--color-primary)", zIndex: 4 }}
        >
          {clock(`${String(Math.floor(now / 60)).padStart(2, "0")}:${String(now % 60).padStart(2, "0")}`).replace(/ (AM|PM)$/, "")}
        </span>
      )}
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────── */

export function ScheduleCalendar({
  selectedId,
  onSelect,
  filter,
}: {
  selectedId: string | null;
  onSelect: (appointmentId: string, anchor: DOMRect) => void;
  /** Hides appointments the page's filter leaves out. */
  filter?: (apt: Appointment) => boolean;
}) {
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState(manilaToday);
  const today = manilaToday();
  const nowOffset = useNowOffset();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [picking, setPicking] = useState(false);

  // The date picker closes on Escape or a press anywhere outside it.
  useEffect(() => {
    if (!picking) return;
    function onPointerDown(e: PointerEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPicking(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPicking(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [picking]);

  const week = weekOf(anchor);
  const visibleDates = view === "week" ? week : [anchor];

  const { data: appointments, isLoading, isError } = useAppointments(
    view === "week" ? { date_from: week[0], date_to: week[6] } : { date: anchor },
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of appointments ?? []) {
      if (filter && !filter(apt)) continue;
      const key = dateOf(apt.scheduled_start);
      map.set(key, [...(map.get(key) ?? []), apt]);
    }
    return map;
  }, [appointments, filter]);

  // Open on the working morning, or an hour before now if that is later.
  useEffect(() => {
    if (!scrollRef.current) return;
    const eight = (8 - HOUR_START) * 2 * SLOT_H;
    scrollRef.current.scrollTop = nowOffset !== null ? Math.max(eight, nowOffset - SLOT_H * 2) : eight;
    // Only on first paint — later minutes must not yank the grid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = view === "week" ? 7 : 1;
  const iconBtn = "flex items-center justify-center rounded-lg transition-colors hover:bg-[var(--color-surface-subtle)]";

  return (
    <div className="card-premium flex flex-col" style={{ height: "100%", overflow: "hidden", borderRadius: 20 }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 shrink-0">
        <div
          ref={pickerRef}
          className="relative flex items-center gap-1 rounded-xl pl-1 pr-1 py-1"
          style={{ border: "1px solid var(--color-border)" }}
        >
          <button
            type="button"
            onClick={() => setPicking((p) => !p)}
            className="flex items-center gap-2 rounded-lg pl-2 pr-2.5 py-1 hover:bg-[var(--color-surface-subtle)]"
            aria-haspopup="dialog"
            aria-expanded={picking}
            title="Choose a date"
          >
            <CalendarDays size={16} style={{ color: "var(--color-muted-foreground)" }} aria-hidden="true" />
            <span className="text-sm font-bold min-w-28 text-left" style={{ color: "var(--color-foreground)" }} aria-live="polite">
              {view === "week" ? monthYear(week[0]!) : longDate(anchor)}
            </span>
          </button>
          {picking && (
            <DatePickerPopover
              value={anchor}
              today={today}
              highlighted={visibleDates}
              onPick={(date) => {
                setAnchor(date);
                setPicking(false);
              }}
            />
          )}
          <button onClick={() => setAnchor(addDays(anchor, -step))} className={iconBtn} style={{ width: 28, height: 28 }} aria-label={`Previous ${view}`}>
            <ChevronLeft size={16} style={{ color: "var(--color-muted-foreground)" }} />
          </button>
          <button onClick={() => setAnchor(addDays(anchor, step))} className={iconBtn} style={{ width: 28, height: 28 }} aria-label={`Next ${view}`}>
            <ChevronRight size={16} style={{ color: "var(--color-muted-foreground)" }} />
          </button>
        </div>

        <button onClick={() => setAnchor(manilaToday())} className="btn btn-secondary btn-sm" style={{ height: 34 }}>
          Today
        </button>

        {isLoading && (
          <div className="w-4 h-4 rounded-full border-2 animate-spin shrink-0" style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }} aria-hidden="true" />
        )}
        {isError && (
          <span className="text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
            Could not load appointments
          </span>
        )}

        <div className="flex-1" />

        <ul className="hidden xl:flex items-center gap-3 mr-2" aria-label="Status colours">
          {LEGEND.map((s) => (
            <li key={s.label} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              <span className="rounded-full" style={{ width: 8, height: 8, background: s.dot }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>

        <div className="flex rounded-xl p-0.75" style={{ background: "var(--color-surface-subtle)" }} role="group" aria-label="Calendar view">
          {(["day", "week"] as CalendarView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn("px-3.5 py-1 text-xs font-semibold capitalize rounded-lg transition-colors", view === v && "shadow-sm")}
              style={
                view === v
                  ? { background: "var(--color-surface)", color: "var(--color-foreground)" }
                  : { color: "var(--color-muted-foreground)" }
              }
              aria-pressed={view === v}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Day header */}
      <div className="flex shrink-0" style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
        <div className="shrink-0 flex items-end justify-center pb-3 text-[11px]" style={{ width: TIME_COL_W, color: "var(--color-subtle-foreground)" }}>
          GMT+8
        </div>
        {visibleDates.map((date) => {
          const isToday = date === today;
          return (
            <button
              type="button"
              key={date}
              onClick={() => {
                setAnchor(date);
                setView("day");
              }}
              className="flex-1 flex flex-col items-center pt-2.5 pb-3 hover:bg-[var(--color-surface-raised)]"
              style={{ borderLeft: "1px solid var(--color-border)" }}
              aria-label={`Open ${longDate(date)}`}
            >
              <span
                className="text-xs font-medium"
                style={{ color: isToday ? "var(--color-primary)" : "var(--color-subtle-foreground)" }}
              >
                {DOW[weekdayOf(date)]}
              </span>
              <span
                className="text-[17px] font-semibold mt-1 w-8 h-8 flex items-center justify-center rounded-[10px]"
                style={isToday ? { background: "var(--color-primary)", color: "#fff" } : { color: "var(--color-foreground)" }}
              >
                {Number(date.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" data-schedule-scroll="1">
        <div className="flex pt-2" style={{ height: totalHeight() + 8 }}>
          <TimeGutter nowOffset={nowOffset} showNow={visibleDates.includes(today)} />
          {visibleDates.map((date) => (
            <DayColumn
              key={date}
              dateKey={date}
              isToday={date === today}
              nowOffset={nowOffset}
              appointments={byDate.get(date) ?? []}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
