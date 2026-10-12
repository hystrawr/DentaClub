"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search, UserPlus, Users, X } from "lucide-react";
import { usePatients } from "@/lib/api/patients";
import { LETTERS, OTHER, directoryName, groupByLetter, initials } from "@/lib/utils/alphabet";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";

/**
 * The alphabetical patient directory.
 *
 * DentalOS lists patients as a paginated table. A small clinic's front desk
 * finds people by surname, so here the whole list is grouped A–Z by last name,
 * with a letter rail to jump straight to a section. The row styling, empty
 * state and loading skeleton follow DentalOS's PatientsList.
 *
 * Letters with no patients are shown but disabled, so the rail never moves and
 * "nobody under Q" is visible at a glance.
 */
export function PatientDirectory({ onAddPatient }: { onAddPatient: () => void }) {
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  // Debounce the filter so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(filter.trim()), 250);
    return () => clearTimeout(timer);
  }, [filter]);

  const { data, isLoading, isError, isFetching } = usePatients({ search });
  const patients = useMemo(() => data ?? [], [data]);
  const groups = useMemo(() => groupByLetter(patients), [patients]);
  const present = new Set(groups.map((g) => g.letter));

  function jumpTo(letter: string) {
    document.getElementById(`letter-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="card-premium overflow-clip">
      {/* Header: title, count, filter */}
      <div className="flex items-center gap-4 px-5 py-4 flex-wrap" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
          Patient Directory
        </h2>
        <span className="text-xs font-medium chip chip-scheduled">
          {isLoading ? "…" : `${patients.length} ${search ? "found" : "records"}`}
        </span>

        <div
          className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)", width: 260 }}
        >
          <Search size={14} style={{ color: "var(--color-subtle-foreground)" }} className="shrink-0" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name or phone…"
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
            aria-label="Filter the directory"
          />
          {isFetching && !isLoading ? (
            <div
              className="w-3 h-3 rounded-full border-2 animate-spin shrink-0"
              style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
              aria-hidden="true"
            />
          ) : (
            filter && (
              <button onClick={() => setFilter("")} aria-label="Clear filter" className="rounded-full p-0.5 hover:bg-slate-200">
                <X size={12} style={{ color: "var(--color-subtle-foreground)" }} />
              </button>
            )
          )}
        </div>
      </div>

      {/* A–Z rail */}
      <nav
        className="flex flex-wrap gap-1 px-5 py-2.5"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface-raised)" }}
        aria-label="Jump to letter"
      >
        {[...LETTERS, OTHER].map((letter) => {
          const has = present.has(letter);
          return (
            <button
              key={letter}
              type="button"
              disabled={!has}
              onClick={() => jumpTo(letter)}
              className="w-7 h-7 rounded-lg text-xs font-semibold transition-colors"
              style={{
                color: has ? "var(--color-primary)" : "var(--color-placeholder)",
                background: has ? "var(--color-primary-light)" : "transparent",
                cursor: has ? "pointer" : "default",
              }}
              aria-label={has ? `Jump to ${letter}` : `No patients under ${letter}`}
            >
              {letter}
            </button>
          );
        })}
      </nav>

      {/* Body */}
      {isError ? (
        <p className="px-5 py-6 text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
          The directory could not be loaded. Check that the backend is running, then reload.
        </p>
      ) : isLoading ? (
        <div className="p-5 space-y-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="rounded-full" style={{ width: 32, height: 32 }} />
              <Skeleton className="h-4" style={{ width: 200 }} />
              <Skeleton className="h-4 ml-auto" style={{ width: 100 }} />
            </div>
          ))}
        </div>
      ) : patients.length === 0 ? (
        search ? (
          <EmptyState icon={Search} title="No matches" description={`No patient's name or phone matches "${search}".`} />
        ) : (
          <EmptyState
            icon={Users}
            title="No patients yet"
            description="Add your first patient to get started."
            action={
              <button onClick={onAddPatient} className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm font-semibold">
                <UserPlus size={14} /> Add Patient
              </button>
            }
          />
        )
      ) : (
        <div>
          {groups.map(({ letter, patients: rows }) => (
            <section key={letter} id={`letter-${letter}`} aria-label={`Patients under ${letter}`} className="scroll-mt-2">
              <h3
                className="sticky top-0 z-10 px-5 py-1.5 text-xs font-bold tracking-wider"
                style={{
                  background: "var(--color-surface-subtle)",
                  color: "var(--color-muted-foreground)",
                  borderBottom: "1px solid var(--color-border)",
                }}
              >
                {letter}
                <span className="ml-2 font-medium" style={{ color: "var(--color-subtle-foreground)" }}>
                  {rows.length}
                </span>
              </h3>

              <ul>
                {rows.map((p) => (
                  <li key={p.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <Link
                      href={`/patients/${p.id}/overview` as Route}
                      className="table-row-hover flex items-center gap-3 px-5 py-3 transition-colors"
                    >
                      <div
                        className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
                        style={{
                          width: 32,
                          height: 32,
                          background: "linear-gradient(135deg, var(--color-primary), var(--color-mint))",
                          fontSize: "0.625rem",
                        }}
                        aria-hidden="true"
                      >
                        {initials(`${p.first_name} ${p.last_name}`)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--color-foreground)" }}>
                          {directoryName(p)}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                          {p.date_of_birth ?? "—"}
                          {p.age != null && ` · ${p.age} yrs`}
                        </p>
                      </div>

                      {p.is_minor && (
                        <span className="chip" style={{ background: "var(--color-purple-light)", color: "var(--color-purple)" }}>
                          Minor
                        </span>
                      )}
          
                      <span className="text-xs font-semibold shrink-0" style={{ color: "var(--color-primary)" }}>
                        View →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
