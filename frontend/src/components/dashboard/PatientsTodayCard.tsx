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
    <section
      className="flex flex-col justify-between gap-3 rounded-[20px] p-5 text-white"
      style={{
        background: "linear-gradient(140deg, #2563EB 0%, #1D4ED8 60%, #0D9488 140%)",
        boxShadow: "var(--shadow-card)",
      }}
      aria-busy={isLoading}
    >
      <h2 className="text-sm font-semibold opacity-85">Patients Today</h2>
      <p className="text-6xl font-extrabold leading-none tracking-tight">{isLoading ? "–" : patients}</p>
      <div className="flex flex-wrap gap-2">
        {[`${done} done`, `${toCome} still to come`].map((label) => (
          <span key={label} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgb(255 255 255 / 0.18)" }}>
            {isLoading ? "…" : label}
          </span>
        ))}
      </div>
    </section>
  );
}
