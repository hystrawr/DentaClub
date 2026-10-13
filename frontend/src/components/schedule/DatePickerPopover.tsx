"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppointments } from "@/lib/api/appointments";
import { addDays, dateOf, monthYear, weekdayOf } from "@/lib/utils/manila";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `2026-10-13` → `2026-10-01`; `offset` moves whole months. */
function monthStart(date: string, offset = 0): string {
  const [y = 0, m = 1] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 10);
}

/**
 * The pop-up behind the schedule's month label: pick a day to jump the
 * calendar there. Clicking the title swaps the day grid for a month-and-year
 * grid, for jumps further than a few months.
 *
 * `highlighted` is what the calendar is showing (the week or the day), so the
 * receptionist can see where they are before they move.
 */
export function DatePickerPopover({
  value,
  today,
  highlighted,
  onPick,
}: {
  value: string;
  today: string;
  highlighted: string[];
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState(() => monthStart(value));
  const [mode, setMode] = useState<"days" | "months">("days");
  const year = Number(month.slice(0, 4));

  const last = addDays(monthStart(month, 1), -1);
  const { data } = useAppointments({ date_from: month, date_to: last });
  const booked = new Set(
    (data ?? []).filter((a) => a.status !== "cancelled" && a.status !== "no_show").map((a) => dateOf(a.scheduled_start)),
  );
  const days = Array.from({ length: Number(last.slice(8)) }, (_, i) => addDays(month, i));
  const lead = weekdayOf(month);

  const step = (n: number) => setMonth((m) => monthStart(m, mode === "days" ? n : n * 12));
  const navBtn = "flex items-center justify-center rounded-lg hover:bg-slate-100";

  return (
    <div
      className="absolute left-0 top-full z-30 mt-2 w-72 rounded-2xl p-3"
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
      role="dialog"
      aria-label="Choose a date"
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMode(mode === "days" ? "months" : "days")}
          className="rounded-lg px-2 py-1 text-sm font-bold hover:bg-slate-100"
          style={{ color: "var(--color-foreground)" }}
          aria-live="polite"
          aria-label={mode === "days" ? `${monthYear(month)} — choose month and year` : `${year} — back to days`}
        >
          {mode === "days" ? monthYear(month) : year}
        </button>
        <div className="flex gap-1">
          <button type="button" onClick={() => step(-1)} className={navBtn} style={{ width: 28, height: 28 }} aria-label={mode === "days" ? "Previous month" : "Previous year"}>
            <ChevronLeft size={16} style={{ color: "var(--color-muted-foreground)" }} />
          </button>
          <button type="button" onClick={() => step(1)} className={navBtn} style={{ width: 28, height: 28 }} aria-label={mode === "days" ? "Next month" : "Next year"}>
            <ChevronRight size={16} style={{ color: "var(--color-muted-foreground)" }} />
          </button>
        </div>
      </div>

      {mode === "months" ? (
        <div className="grid grid-cols-3 gap-1.5">
          {MONTHS.map((label, i) => {
            const first = `${year}-${String(i + 1).padStart(2, "0")}-01`;
            const isCurrent = first === monthStart(value);
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  setMonth(first);
                  setMode("days");
                }}
                className={cn("h-10 rounded-[10px] text-sm font-semibold transition-colors", !isCurrent && "hover:bg-slate-50")}
                style={{
                  background: isCurrent ? "var(--color-primary)" : undefined,
                  color: isCurrent ? "#fff" : first === monthStart(today) ? "var(--color-primary)" : "var(--color-foreground)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 text-center mb-1">
            {WEEKDAYS.map((d) => (
              <span key={d} className="py-1 text-[11px] font-semibold" style={{ color: "var(--color-subtle-foreground)" }}>
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {days.map((d) => {
              const isValue = d === value;
              const inView = highlighted.includes(d);
              const isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onPick(d)}
                  aria-pressed={isValue}
                  aria-label={`${d}${isToday ? ", today" : ""}${booked.has(d) ? ", has appointments" : ""}`}
                  className={cn(
                    "relative h-9 flex items-center justify-center rounded-[10px] text-[13px] transition-colors",
                    !isValue && "hover:bg-slate-100",
                    (isValue || isToday) && "font-bold",
                  )}
                  style={{
                    background: isValue ? "var(--color-primary)" : inView ? "var(--color-primary-light)" : undefined,
                    color: isValue ? "#fff" : isToday ? "var(--color-primary)" : "var(--color-foreground)",
                    border: isToday && !isValue ? "1.5px solid var(--color-primary)" : "1.5px solid transparent",
                  }}
                >
                  {Number(d.slice(8))}
                  {booked.has(d) && (
                    <span
                      className="absolute rounded-full"
                      style={{ bottom: 4, width: 4, height: 4, background: isValue ? "#fff" : "var(--color-primary)" }}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex justify-end mt-2 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
        <button
          type="button"
          onClick={() => onPick(today)}
          className="rounded-lg px-2 py-1 text-xs font-semibold hover:bg-slate-100"
          style={{ color: "var(--color-primary)" }}
        >
          Go to today
        </button>
      </div>
    </div>
  );
}
