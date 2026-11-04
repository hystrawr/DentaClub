"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useOperatories, useRescheduleAppointment, useSlots } from "@/lib/api/appointments";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormError } from "@/components/ui/form";
import { conflictNote } from "@/lib/utils/appointment-status";
import { addMinutes, clock, dateOf, fullDate, manilaTimestamp, manilaToday, minutesOf, timeOf } from "@/lib/utils/manila";
import { LUNCH_MESSAGE, overlapsLunch } from "@/lib/schedule/lunch";
import type { Appointment } from "@/types/api";

/**
 * Move an appointment to a new day, time or chair, with the same dentist and
 * length. Free times come from the dentist's hours, as when booking.
 *
 * Rendered into `document.body` above every sheet and popover, and marked
 * `data-keeps-popover` so the schedule popover it opens from stays open.
 */
export function RescheduleModal({ appointment, onClose }: { appointment: Appointment; onClose: () => void }) {
  const reschedule = useRescheduleAppointment(appointment.id);
  const { data: chairs = [] } = useOperatories();

  const length = minutesOf(appointment.scheduled_end) - minutesOf(appointment.scheduled_start);
  const [date, setDate] = useState(dateOf(appointment.scheduled_start));
  const [startTime, setStartTime] = useState(timeOf(appointment.scheduled_start));
  const [endTime, setEndTime] = useState(timeOf(appointment.scheduled_end));
  const [chairId, setChairId] = useState(appointment.operatory?.id ?? "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // The dentist's free 15-minute steps, kept only where the whole visit fits.
  const providerId = appointment.provider?.id;
  const slots = useSlots(providerId, date || undefined, 15);
  const freeSteps = (slots.data ?? []).map((s) => s.start);
  const free = new Set(freeSteps);
  const stepsNeeded = Math.max(1, Math.ceil(length / 15));
  const fitting = freeSteps.filter((start) =>
    Array.from({ length: stepsNeeded }, (_, i) => addMinutes(start, i * 15)).every((t) => free.has(t)),
  );

  function chooseStart(value: string) {
    setStartTime(value);
    setEndTime(addMinutes(value, length));
  }

  const endBeforeStart = endTime <= startTime;
  const sameTime =
    manilaTimestamp(date, startTime) === appointment.scheduled_start.replace(/\.\d+/, "") &&
    manilaTimestamp(date, endTime) === appointment.scheduled_end.replace(/\.\d+/, "");
  const unchanged = sameTime && chairId === (appointment.operatory?.id ?? "");
  // Like the server, only a new time is checked: one already over lunch can still change chair.
  const duringLunch = !sameTime && !endBeforeStart && overlapsLunch(startTime, endTime);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || endBeforeStart || duringLunch) return;
    reschedule.mutate(
      {
        scheduled_start: manilaTimestamp(date, startTime),
        scheduled_end: manilaTimestamp(date, endTime),
        operatory_id: chairId || null,
      },
      { onSuccess: onClose },
    );
  }

  const control = "w-full h-9 rounded-lg px-3 text-sm outline-none field-focus";
  const controlStyle = { background: "var(--color-surface)", border: "1px solid var(--color-border)" };

  return createPortal(
    <div data-keeps-popover>
      <div className="fixed inset-0 z-[60]" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Reschedule appointment" className="fixed z-[61] inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="card-premium w-full max-w-md pointer-events-auto" style={{ maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
              Reschedule appointment
            </h2>
            <button type="button" onClick={onClose} className="btn-ghost p-1 rounded-md" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
            {/* Only the fields scroll (.modal-body); the title above and the buttons below stay put. */}
            <div className="modal-body px-5 py-4 space-y-4">
              <div className="rounded-lg px-3 py-2.5 text-xs space-y-0.5" style={{ background: "var(--color-surface-subtle)", color: "var(--color-muted-foreground)" }}>
                <p className="font-semibold" style={{ color: "var(--color-foreground)" }}>
                  {appointment.patient?.full_name ?? appointment.appointment_type?.name ?? "Appointment"}
                </p>
                <p>
                  Now: {fullDate(dateOf(appointment.scheduled_start))}, {clock(timeOf(appointment.scheduled_start))}–
                  {clock(timeOf(appointment.scheduled_end))}
                </p>
                {appointment.provider && <p>With {appointment.provider.name} · {length} min</p>}
              </div>

              <div>
                <label htmlFor="resched-date" className="text-xs font-medium block mb-1" style={{ color: "var(--color-foreground)" }}>
                  New date
                </label>
                <input
                  id="resched-date"
                  type="date"
                  min={manilaToday()}
                  className={control}
                  style={controlStyle}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {providerId && date && (
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-foreground)" }}>
                    Free times for {length} min
                  </p>
                  {slots.isLoading ? (
                    <div className="skeleton" style={{ height: 30 }} />
                  ) : fitting.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
                      {slots.data?.length ? "No gap long enough on this day." : "This dentist has no working hours on this day."} You can still enter a time below.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto" role="listbox" aria-label="Free start times">
                      {fitting.map((start) => (
                        <button
                          key={start}
                          type="button"
                          role="option"
                          aria-selected={startTime === start}
                          onClick={() => chooseStart(start)}
                          className="text-xs font-semibold rounded-full px-2.5 py-1"
                          style={{
                            border: `1px solid ${startTime === start ? "var(--color-primary)" : "var(--color-border)"}`,
                            background: startTime === start ? "var(--color-primary)" : "var(--color-surface)",
                            color: startTime === start ? "#fff" : "var(--color-foreground)",
                          }}
                        >
                          {clock(start)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="resched-start" className="text-xs font-medium block mb-1" style={{ color: "var(--color-foreground)" }}>
                    Start
                  </label>
                  <input
                    id="resched-start"
                    type="time"
                    step={300}
                    className={control}
                    style={{ ...controlStyle, borderColor: duringLunch ? "var(--color-destructive)" : "var(--color-border)" }}
                    value={startTime}
                    onChange={(e) => chooseStart(e.target.value)}
                  />
                  {duringLunch && (
                    <p className="mt-1 text-xs" style={{ color: "var(--color-destructive)" }}>
                      {LUNCH_MESSAGE}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="resched-end" className="text-xs font-medium block mb-1" style={{ color: "var(--color-foreground)" }}>
                    End
                  </label>
                  <input
                    id="resched-end"
                    type="time"
                    step={300}
                    className={control}
                    style={{ ...controlStyle, borderColor: endBeforeStart ? "var(--color-destructive)" : "var(--color-border)" }}
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                  {endBeforeStart && (
                    <p className="mt-1 text-xs" style={{ color: "var(--color-destructive)" }}>
                      End time must be after start time.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="resched-chair" className="text-xs font-medium block mb-1" style={{ color: "var(--color-foreground)" }}>
                  Chair
                </label>
                <Dropdown
                  id="resched-chair"
                  value={chairId}
                  onChange={setChairId}
                  placeholder="Unassigned"
                  options={chairs.map((c) => ({ value: c.id, label: c.name }))}
                />
              </div>

            </div>

            <div className="shrink-0 px-5 py-3 space-y-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              {reschedule.error && (
                <div className="text-xs" style={{ color: "var(--color-destructive)" }}>
                  <FormError error={reschedule.error} />
                  {conflictNote(reschedule.error) && <p>{conflictNote(reschedule.error).trim()}</p>}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="btn-gradient flex-1 py-2 text-sm font-semibold"
                  disabled={reschedule.isPending || !date || endBeforeStart || unchanged}
                >
                  {reschedule.isPending ? "Saving…" : "Reschedule"}
                </button>
                <button type="button" className="btn-ghost px-4 text-sm" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body,
  );
}
