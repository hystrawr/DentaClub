"use client";

import { initials } from "@/lib/utils/alphabet";
import type { Patient } from "@/types/api";

const SEX_LABEL: Record<string, string> = { male: "Male", female: "Female", other: "Other" };

/**
 * The top of the patient record: the photo square, the patient's name, the
 * basics under it, and the record's actions on the right.
 *
 * There is no photo upload yet, so the square shows initials. While loading,
 * the name is a skeleton rather than a placeholder name.
 */
export function PatientHero({ patient, loading, actions }: { patient?: Patient; loading: boolean; actions?: React.ReactNode }) {
  const details = patient
    ? [
        SEX_LABEL[patient.sex],
        patient.age != null ? `${patient.age} yrs` : null,
        patient.date_of_birth ? `Born ${patient.date_of_birth}` : null,
        patient.mobile,
      ].filter(Boolean)
    : [];

  return (
    <section className="card-premium flex items-center gap-4 px-5 py-4">
      <div
        className="flex items-center justify-center shrink-0 text-white font-bold w-14 h-14 text-lg rounded-xl"
        style={{ background: "linear-gradient(135deg, var(--color-primary), var(--color-mint))" }}
        aria-hidden="true"
      >
        {initials(patient?.full_name)}
      </div>

      <div className="min-w-0 flex-1">
        {loading && !patient ? (
          <span className="skeleton block" style={{ height: 28, width: 260, maxWidth: "100%" }} aria-hidden="true" />
        ) : (
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              className="text-xl sm:text-2xl font-bold leading-tight tracking-tight"
              style={{ color: "var(--color-foreground)", textWrap: "balance" }}
            >
              {patient?.full_name ?? "Unknown patient"}
            </h1>
            {patient?.is_minor && (
              <span className="chip" style={{ background: "var(--color-purple-light)", color: "var(--color-purple)" }}>
                Minor — guardian signs consent
              </span>
            )}
          </div>
        )}

        {details.length > 0 && (
          <p className="text-[13px] mt-1" style={{ color: "var(--color-muted-foreground)" }}>
            {details.join("  ·  ")}
          </p>
        )}
      </div>

      {actions && <div className="shrink-0 self-start">{actions}</div>}
    </section>
  );
}
