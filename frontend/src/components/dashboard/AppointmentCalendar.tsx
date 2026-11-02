"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppointments } from "@/lib/api/appointments";
import { addDays, dateOf, weekdayOf } from "@/lib/utils/manila";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** `2026-10-13` → `2026-10-01`; `offset` moves whole months. */
function monthStart(date: string, offset = 0): string {
  const [y = 0, m = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10);
}

/** "October 2026" */
function monthLabel(first: string): string {
  return new Date(`${first}T00:00:00Z`).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Month grid for picking the day the upcoming list shows. Today is outlined,
 * the picked day is filled, and a dot marks every day with a booking.
 */
export function AppointmentCalendar({
  today,
  selected,
  onSelect,
}: {
  today: string;
  selected: string;
  onSelect: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => monthStart(selected));
  const last = addDays(monthStart(month, 1), -1);
  const { data } = useAppointments({ date_from: month, date_to: last });

  const booked = new Set(
    (data ?? []).filter((a) => a.status !== "cancelled" && a.status !== "no_show").map((a) => dateOf(a.scheduled_start)),
  );
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => addDays(month, i));
  const lead = weekdayOf(month);
  const weeks = Math.ceil((lead + days.length) / 7);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center justify-between pb-3 mb-2 shrink-0"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <p className="text-[15px] font-bold" style={{ color: "var(--color-foreground)" }} aria-live="polite">
          {monthLabel(month)}
        </p>
        <div className="flex gap-1.5">
          {[
            { label: "Previous month", icon: ChevronLeft, step: -1 },
            { label: "Next month", icon: ChevronRight, step: 1 },
          ].map(({ label, icon: Icon, step }) => (
            <button
              key={label}
              type="button"
              onClick={() => setMonth((m) => monthStart(m, step))}
              aria-label={label}
              className="flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-raised)]"
              style={{ width: 28, height: 28, border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)" }}
            >
              <Icon size={14} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center shrink-0">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="pb-1.5 text-[10px] font-semibold tracking-wider"
            style={{ color: "var(--color-subtle-foreground)" }}
          >
            {d}
          </div>
        ))}
      </div>
      {/* Rows share the height the card has left, between a tappable minimum and the natural size. */}
      <div
        className="grid grid-cols-7 gap-1 text-center flex-1 min-h-0 content-start"
        style={{ gridTemplateRows: `repeat(${weeks}, minmax(22px, 38px))` }}
      >
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {days.map((d) => {
          const isSelected = d === selected;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-pressed={isSelected}
              aria-label={`${d}${isToday ? ", today" : ""}${booked.has(d) ? ", has appointments" : ""}`}
              className={cn(
                "relative flex items-center justify-center rounded-[10px] text-[13px] transition-colors",
                !isSelected && "hover:bg-[var(--color-surface-raised)]",
                (isSelected || isToday) && "font-bold",
              )}
              style={{
                height: "100%",
                background: isSelected ? "var(--color-primary)" : undefined,
                color: isSelected ? "var(--color-primary-foreground)" : isToday ? "var(--color-primary)" : "var(--color-foreground)",
                border: isToday && !isSelected ? "1.5px solid var(--color-primary)" : "1.5px solid transparent",
              }}
            >
              {Number(d.slice(8))}
              {booked.has(d) && (
                <span
                  className="absolute rounded-full"
                  style={{
                    bottom: "12%",
                    width: 4,
                    height: 4,
                    background: isSelected ? "var(--color-primary-foreground)" : "var(--color-primary)",
                  }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 mt-3 shrink-0 text-[11px] [@media(max-height:720px)]:hidden" style={{ color: "var(--color-muted-foreground)" }}>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full" style={{ width: 8, height: 8, background: "var(--color-primary)" }} aria-hidden="true" />
          Has appointments
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="rounded-full"
            style={{ width: 8, height: 8, border: "1.5px solid var(--color-primary)" }}
            aria-hidden="true"
          />
          Today
        </span>
      </div>
    </div>
  );
}
