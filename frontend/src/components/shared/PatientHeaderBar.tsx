"use client";

import { initials } from "@/lib/utils/alphabet";

export interface PatientHeaderBarProps {
  name?: string;
  dateOfBirth?: string;
  age?: number;
  isMinor?: boolean;
  loading?: boolean;
  /** Buttons for the right-hand side; rendered only when given. */
  actions?: React.ReactNode;
}

/**
 * The patient identity bar at the top of every patient page (from DentalOS).
 *
 * Nothing here invents a default: while loading, the name is a skeleton rather
 * than a placeholder name, because a name that is about to change is worse than
 * one that is visibly not there yet. (DentalOS's balance and allergy chips are
 * left out — there is no billing or medical profile in this project.)
 */
export function PatientHeaderBar({ name, dateOfBirth, age, isMinor, loading = false, actions }: PatientHeaderBarProps) {
  const meta = dateOfBirth ? `DOB: ${dateOfBirth}${age != null ? ` · ${age} yrs` : ""}` : "";

  return (
    <div
      className="flex items-center gap-4 px-6 py-4 shrink-0"
      style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
    >
      <div
        className="flex items-center justify-center rounded-2xl text-white font-bold shrink-0"
        style={{
          width: 48,
          height: 48,
          background: "linear-gradient(135deg, var(--color-primary), var(--color-mint))",
          fontSize: "1rem",
        }}
        aria-hidden="true"
      >
        {initials(name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          {loading && !name ? (
            <span className="skeleton" style={{ height: 18, width: 180, borderRadius: 6 }} aria-hidden="true" />
          ) : (
            <h1 className="text-base font-bold leading-tight" style={{ color: "var(--color-foreground)" }}>
              {name ?? "Unknown patient"}
            </h1>
          )}
          {isMinor && (
            <span className="chip" style={{ background: "var(--color-purple-light)", color: "var(--color-purple)" }}>
              Minor — parent or guardian signs consent
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          {loading && !meta ? " " : meta || "No demographics recorded"}
        </p>
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
