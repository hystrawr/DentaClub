"use client";

import type { Appointment } from "@/types/api";

/**
 * How many different patients are booked today, and how many of them are done.
 * Cancellations, no-shows and blocked time are not patients in the chair, so
 * they are left out.
 */
export function PatientsTodayCard({ appointments, isLoading }: { appointments: Appointment[]; isLoading: boolean }) {
  const booked = appointments.filter((a) => a.patient && a.status !== "cancelled" && a.status !== "no_show");
  const patients = new Set(booked.map((a) => a.patient!.id)).size;
  const done = booked.filter((a) => a.status === "completed").length;
  const toCome = booked.length - done;

  return (
    // The dashboard's one field of brand colour: flat olive, cream type.
    <section
      className="flex flex-col justify-between gap-3 rounded-[var(--radius-xl)] p-5"
      style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      aria-busy={isLoading}
    >
      <h2 className="text-sm font-semibold">Patients today</h2>
      <p className="text-[40px] font-bold leading-none tracking-tight tabular-nums">{isLoading ? "–" : patients}</p>
      <div className="flex flex-wrap gap-2">
        {[`${done} done`, `${toCome} still to come`].map((label) => (
          <span key={label} className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "rgb(249 250 224 / 0.16)" }}>
            {isLoading ? "…" : label}
          </span>
        ))}
      </div>
    </section>
  );
}
