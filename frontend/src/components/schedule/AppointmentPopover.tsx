"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Mail, Phone, X } from "lucide-react";
import { useAppointment } from "@/lib/api/appointments";
import { usePatient } from "@/lib/api/patients";
import { appointmentColor, initialsOf, styleFor } from "@/lib/utils/appointment-status";
import { clock, timeOf } from "@/lib/utils/manila";
import { AppointmentActions } from "./AppointmentActions";

const WIDTH = 320;
const GAP = 10;
const MARGIN = 12;

/**
 * The appointment card that opens beside a block on the schedule: who, what,
 * when, and the buttons to move it along. Replaces the slide-in panel on this
 * page so the calendar stays in view.
 *
 * It sits to the right of the block, flips left when there is no room, and
 * closes on Escape, an outside click, or any scroll (the block it points at
 * would have moved).
 */
export function AppointmentPopover({
  appointmentId,
  anchor,
  onClose,
}: {
  appointmentId: string | null;
  anchor: DOMRect | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const { data: apt, isLoading } = useAppointment(appointmentId);
  const patient = usePatient(apt?.patient?.id);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return setPosition(null);
    const height = ref.current.offsetHeight;
    const fitsRight = anchor.right + GAP + WIDTH <= window.innerWidth - MARGIN;
    const left = fitsRight ? anchor.right + GAP : Math.max(MARGIN, anchor.left - GAP - WIDTH);
    const top = Math.max(MARGIN, Math.min(anchor.top, window.innerHeight - height - MARGIN));
    setPosition({ left, top });
  }, [anchor, apt, patient.data]);

  useEffect(() => {
    if (!appointmentId) return;
    // A dialog opened from the popover (Reschedule) is outside it in the DOM, but still part of it.
    const inside = (target: EventTarget | null) =>
      target instanceof Node &&
      (ref.current?.contains(target) || Boolean((target as HTMLElement).closest?.("[data-keeps-popover]")));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.querySelector("[data-keeps-popover]")) onClose();
    }
    function onPointerDown(e: PointerEvent) {
      // A press on another block re-targets the popover instead of closing it.
      if (inside(e.target) || (e.target as HTMLElement).closest?.("[data-appt-block]")) return;
      onClose();
    }
    function onScroll(e: Event) {
      if (!inside(e.target)) onClose();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onClose);
    };
  }, [appointmentId, onClose]);

  if (!appointmentId || !anchor) return null;

  const color = apt ? appointmentColor(apt) : "var(--color-border-strong)";
  const status = apt ? styleFor(apt.status) : null;
  const name = apt?.patient?.full_name ?? "Blocked time";

  return (
    <div
      ref={ref}
      className="fixed z-40 flex flex-col"
      style={{
        width: WIDTH,
        left: position?.left ?? anchor.right + GAP,
        top: position?.top ?? anchor.top,
        visibility: position ? "visible" : "hidden",
        maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 18,
        boxShadow: "0 12px 40px -8px rgb(15 23 42 / 0.22), 0 2px 6px rgb(15 23 42 / 0.06)",
      }}
      role="dialog"
      aria-label="Appointment details"
    >
      {isLoading || !apt ? (
        <div className="p-4 space-y-3" aria-busy="true">
          {[70, 50, 90, 60].map((w, i) => (
            <div key={i} className="skeleton" style={{ height: 20, width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <>
          <div className="flex gap-3 px-4 pt-4 pb-3.5" style={{ borderBottom: "1px solid var(--color-border)" }}>
            {apt.patient && (
              <span
                className="flex items-center justify-center rounded-full shrink-0 text-sm font-bold text-white"
                style={{ width: 40, height: 40, background: color }}
                aria-hidden="true"
              >
                {initialsOf(name)}
              </span>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-[15px] font-bold truncate" style={{ color: "var(--color-foreground)" }}>
                {name}
              </h2>
              {patient.data && (
                <div className="mt-1 space-y-0.5 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  {patient.data.mobile && (
                    <p className="flex items-center gap-1.5">
                      <Phone size={12} aria-hidden="true" />
                      {patient.data.mobile}
                    </p>
                  )}
                  {patient.data.email && (
                    <a
                      href={`mailto:${patient.data.email}`}
                      className="flex items-center gap-1.5 hover:underline truncate"
                      style={{ color: "var(--color-primary)" }}
                    >
                      <Mail size={12} aria-hidden="true" />
                      {patient.data.email}
                    </a>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center rounded-lg shrink-0 hover:bg-surface-subtle"
              style={{ width: 28, height: 28 }}
              aria-label="Close"
            >
              <X size={16} style={{ color: "var(--color-muted-foreground)" }} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
            {status && (
              <span className="chip" style={{ background: status.bg, color: status.text, border: `1px solid ${status.border}`, fontWeight: 600 }}>
                <span className="rounded-full" style={{ width: 6, height: 6, background: status.dot }} aria-hidden="true" />
                {status.label}
              </span>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Fact label="Procedure" swatch={apt.appointment_type?.color_hex}>
                {apt.appointment_type?.name ?? "—"}
              </Fact>
              <Fact label="Dentist" swatch={apt.provider?.color_hex}>
                {apt.provider?.name ?? "—"}
              </Fact>
              <Fact label="Time" wide>
                {clock(timeOf(apt.scheduled_start))} – {clock(timeOf(apt.scheduled_end))}
              </Fact>
            </dl>

            {apt.notes && (
              <p className="text-xs rounded-lg px-2.5 py-2 whitespace-pre-wrap" style={{ background: "var(--color-surface-subtle)", color: "var(--color-muted-foreground)" }}>
                {apt.notes}
              </p>
            )}
            {apt.cancellation_reason && (
              <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
                Cancelled: {apt.cancellation_reason}
              </p>
            )}
          </div>

          <div className="px-4 pt-3 pb-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            <AppointmentActions
              key={apt.id}
              appointment={apt}
              layout="row"
              extra={
                apt.patient && (
                  <Link href={`/patients/${apt.patient.id}/chart` as Route} className="btn btn-secondary flex-1 whitespace-nowrap">
                    Open chart
                  </Link>
                )
              }
            />
          </div>
        </>
      )}
    </div>
  );
}

function Fact({ label, swatch, wide, children }: { label: string; swatch?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "col-span-2" : "min-w-0"}>
      <dt className="text-[11px]" style={{ color: "var(--color-subtle-foreground)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--color-foreground)" }}>
        {swatch && <span className="rounded-[3px] shrink-0" style={{ width: 8, height: 8, background: swatch }} aria-hidden="true" />}
        <span className="truncate">{children}</span>
      </dd>
    </div>
  );
}
