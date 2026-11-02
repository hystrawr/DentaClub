"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";
import { usePatients } from "@/lib/api/patients";
import { useProviders } from "@/lib/api/appointments";
import { initials } from "@/lib/utils/alphabet";
import { addDays, clock, dateOf, fullDate, manilaToday, timeOf } from "@/lib/utils/manila";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import type { PatientListItem, PatientVisit } from "@/types/api";

const PAGE_SIZE = 20;

type SortKey = "last" | "first" | "visit" | "appointment";
type AppointmentFilter = "all" | "has" | "none";
/** Current patients, or the ones removed from the directory (to look up or restore). */
type StatusFilter = "active" | "inactive";

export interface PatientFilter {
  status: StatusFilter;
  appointment: AppointmentFilter;
  /** Dentist ids to show; empty means every dentist. */
  providers: string[];
}

const DEFAULT_FILTER: PatientFilter = { status: "active", appointment: "all", providers: [] };

/** The dentist a patient is seeing next, or saw last. */
const doctorOf = (p: PatientListItem) => (p.next_appointment ?? p.last_visit)?.provider ?? null;

/** Sort values; a missing date sorts last whichever way the column runs. */
const sortValue: Record<SortKey, (p: PatientListItem) => string | null> = {
  last: (p) => `${p.last_name} ${p.first_name}`.toLowerCase(),
  first: (p) => `${p.first_name} ${p.last_name}`.toLowerCase(),
  visit: (p) => p.last_visit?.start ?? null,
  appointment: (p) => p.next_appointment?.start ?? null,
};

/**
 * The patient list: one row per patient with their last visit, next
 * appointment and dentist, filtered by the search box and the Filter menu.
 * Search runs on the server; sorting, filtering and paging happen here.
 */
export function PatientList({ onAddPatient }: { onAddPatient: () => void }) {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PatientFilter>(DEFAULT_FILTER);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "last", dir: 1 });
  const [page, setPage] = useState(0);

  // Debounce the search so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError, isFetching } = usePatients({ search, status: filter.status });

  const rows = useMemo(() => {
    const value = sortValue[sort.key];
    return (data ?? [])
      .filter((p) => {
        if (filter.appointment === "has" && !p.next_appointment) return false;
        if (filter.appointment === "none" && p.next_appointment) return false;
        if (filter.providers.length > 0) {
          const doctor = doctorOf(p);
          if (!doctor || !filter.providers.includes(doctor.id)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const x = value(a);
        const y = value(b);
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return x < y ? -sort.dir : sort.dir;
      });
  }, [data, filter, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // A refetch can shrink the list under the current page; show the last one that exists.
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const filtered = Boolean(search) || filter.status !== "active" || filter.appointment !== "all" || filter.providers.length > 0;
  const weekEnd = addDays(manilaToday(), 7);

  // Any change to what is shown starts back on the first page.
  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
    setPage(0);
  }

  function applyFilter(next: PatientFilter) {
    setFilter(next);
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Title and toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-foreground)" }}>
            Patient List
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            {isLoading ? "Loading patients…" : `${rows.length} patient${rows.length === 1 ? "" : "s"}${filtered ? " found" : ""}`}
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-3 rounded-full w-full sm:w-64"
          style={{ height: 36, background: "var(--color-surface)", border: "1px solid var(--color-border-strong)" }}
        >
          <Search size={14} style={{ color: "var(--color-subtle-foreground)" }} className="shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for patient…"
            className="flex-1 bg-transparent text-sm outline-none min-w-0"
            aria-label="Search for patient"
          />
          {isFetching && !isLoading ? (
            <div
              className="w-3 h-3 rounded-full border-2 animate-spin shrink-0"
              style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
              aria-hidden="true"
            />
          ) : (
            query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="rounded-full p-0.5 hover:bg-slate-100">
                <X size={12} style={{ color: "var(--color-subtle-foreground)" }} />
              </button>
            )
          )}
        </div>

        <PatientFilterMenu value={filter} onChange={applyFilter} />

        <button className="btn btn-primary" onClick={onAddPatient}>
          <UserPlus size={15} aria-hidden="true" />
          New Patient
        </button>
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden">
        {isError ? (
          <p className="px-5 py-6 text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
            The patient list could not be loaded. Check that the backend is running, then reload.
          </p>
        ) : isLoading ? (
          <div className="p-5 space-y-4" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="rounded-full" style={{ width: 40, height: 40 }} />
                <Skeleton className="h-4" style={{ width: 120 }} />
                <Skeleton className="h-4" style={{ width: 120 }} />
                <Skeleton className="h-4 ml-auto" style={{ width: 140 }} />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          filtered ? (
            <EmptyState icon={Search} title="No matches" description="No patient matches your search and filters." />
          ) : (
            <EmptyState
              icon={Users}
              title="No patients yet"
              description="Add your first patient to get started."
              action={
                <button onClick={onAddPatient} className="btn btn-primary">
                  <UserPlus size={14} aria-hidden="true" /> Add Patient
                </button>
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr style={{ background: "var(--color-surface-subtle)", borderBottom: "1px solid var(--color-border)" }}>
                    <th className="w-16" aria-label="Photo" />
                    <SortHeader label="Last Name" active={sort.key === "last"} dir={sort.dir} onClick={() => sortBy("last")} />
                    <SortHeader label="First Name" active={sort.key === "first"} dir={sort.dir} onClick={() => sortBy("first")} />
                    <SortHeader label="Last Visit" active={sort.key === "visit"} dir={sort.dir} onClick={() => sortBy("visit")} />
                    <SortHeader
                      label="Appointment"
                      active={sort.key === "appointment"}
                      dir={sort.dir}
                      onClick={() => sortBy("appointment")}
                    />
                    <Th>Doctor</Th>
                    <th className="sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const doctor = doctorOf(p);
                    const soon = p.next_appointment !== null && dateOf(p.next_appointment.start) <= weekEnd;
                    return (
                      <tr key={p.id} className="patient-row" style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td className="pl-4 py-3">
                          <div
                            className="flex items-center justify-center rounded-full text-white font-bold"
                            style={{
                              width: 40,
                              height: 40,
                              background: "linear-gradient(135deg, var(--color-primary), var(--color-mint))",
                              fontSize: "0.75rem",
                            }}
                            aria-hidden="true"
                          >
                            {initials(`${p.first_name} ${p.last_name}`)}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-foreground)" }}>
                          {p.last_name}
                          {filter.status === "inactive" && (
                            <span className="chip ml-1.5 !py-0 !text-[11px]" style={{ background: "#FEF3C7", color: "#92400E" }}>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--color-foreground)" }}>
                          {p.first_name}
                        </td>
                        <td className="px-4 py-3">
                          <When visit={p.last_visit} />
                        </td>
                        <td className="px-4 py-3">
                          <When visit={p.next_appointment} soon={soon} />
                        </td>
                        <td className="px-4 py-3">
                          {doctor ? (
                            <span className="flex items-center gap-2 whitespace-nowrap" style={{ color: "var(--color-foreground)" }}>
                              <span
                                className="flex items-center justify-center rounded-full text-[10px] font-bold shrink-0"
                                style={{ width: 24, height: 24, background: "var(--color-mint-light)", color: "var(--color-mint)" }}
                                aria-hidden="true"
                              >
                                {initials(doctor.name.replace(/^Dr\.?\s+/i, ""))}
                              </span>
                              {doctor.name}
                            </span>
                          ) : (
                            <span className="text-[13px]" style={{ color: "var(--color-subtle-foreground)" }}>
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap" style={{ borderLeft: "1px solid var(--color-border)" }}>
                          <Link
                            href={`/patients/${p.id}/info` as Route}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold hover:bg-blue-50"
                            style={{ color: "var(--color-primary)" }}
                            aria-label={`View patient record of ${p.first_name} ${p.last_name}`}
                          >
                            View Patient Record <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="flex items-center justify-between px-4 py-3 text-[13px]"
              style={{ background: "var(--color-surface-raised)", color: "var(--color-muted-foreground)" }}
            >
              <span>
                Showing {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {rows.length}
              </span>
              {pages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPage(current - 1)}
                    disabled={current === 0}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="px-2">
                    Page {current + 1} of {pages}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPage(current + 1)}
                    disabled={current >= pages - 1}
                    aria-label="Next page"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-4 py-3.5 text-left text-xs font-bold uppercase tracking-wide whitespace-nowrap"
      style={{ color: "var(--color-muted-foreground)" }}
    >
      {children}
    </th>
  );
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: 1 | -1; onClick: () => void }) {
  const Icon = !active ? ArrowUpDown : dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th
      className="px-4 py-3.5 text-left whitespace-nowrap"
      aria-sort={active ? (dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide hover:text-slate-900"
        style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
      >
        {label}
        <Icon size={12} style={{ opacity: active ? 1 : 0.4 }} aria-hidden="true" />
      </button>
    </th>
  );
}

/** A visit's date with the time beneath, or a muted "None". */
function When({ visit, soon = false }: { visit: PatientVisit | null; soon?: boolean }) {
  if (!visit) {
    return (
      <span className="text-[13px]" style={{ color: "var(--color-subtle-foreground)" }}>
        None
      </span>
    );
  }
  return (
    <div className="whitespace-nowrap">
      <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
        {fullDate(dateOf(visit.start))}
        {soon && <span className="chip chip-scheduled ml-1.5 !py-0 !text-[11px]">This week</span>}
      </div>
      <div className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        {clock(timeOf(visit.start))}
      </div>
    </div>
  );
}

/** The Filter button and its menu: current or removed patients, upcoming appointment or not, and which dentist. */
function PatientFilterMenu({ value, onChange }: { value: PatientFilter; onChange: (next: PatientFilter) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const providers = useProviders();
  const active = (value.status !== "active" ? 1 : 0) + (value.appointment !== "all" ? 1 : 0) + value.providers.length;

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const statusOptions: Array<{ key: StatusFilter; label: string }> = [
    { key: "active", label: "Current patients" },
    { key: "inactive", label: "Removed patients" },
  ];

  const appointmentOptions: Array<{ key: AppointmentFilter; label: string }> = [
    { key: "all", label: "All patients" },
    { key: "has", label: "Has an upcoming appointment" },
    { key: "none", label: "No upcoming appointment" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filter
        {active > 0 && (
          <span
            className="rounded-full px-1.5 text-[10px] font-bold leading-4"
            style={{ background: "var(--color-primary)", color: "#fff" }}
            aria-label={`${active} active`}
          >
            {active}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-72 rounded-2xl p-3"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
        >
          <Group title="Patients">
            {statusOptions.map((o) => (
              <label
                key={o.key}
                className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm cursor-pointer hover:bg-slate-50"
                style={{ color: "var(--color-foreground)" }}
              >
                <input
                  type="radio"
                  name="patient-status-filter"
                  checked={value.status === o.key}
                  onChange={() => onChange({ ...value, status: o.key })}
                  className="accent-blue-600"
                />
                {o.label}
              </label>
            ))}
          </Group>
          <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
          <Group title="Appointment">
            {appointmentOptions.map((o) => (
              <label
                key={o.key}
                className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm cursor-pointer hover:bg-slate-50"
                style={{ color: "var(--color-foreground)" }}
              >
                <input
                  type="radio"
                  name="patient-appointment-filter"
                  checked={value.appointment === o.key}
                  onChange={() => onChange({ ...value, appointment: o.key })}
                  className="accent-blue-600"
                />
                {o.label}
              </label>
            ))}
          </Group>
          <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
          <Group title="Doctor">
            {providers.isLoading && (
              <p className="px-1 py-1.5 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                Loading…
              </p>
            )}
            {providers.data
              ?.filter((p) => p.is_active)
              .map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm cursor-pointer hover:bg-slate-50"
                  style={{ color: "var(--color-foreground)" }}
                >
                  <input
                    type="checkbox"
                    checked={value.providers.includes(p.id)}
                    onChange={() =>
                      onChange({
                        ...value,
                        providers: value.providers.includes(p.id)
                          ? value.providers.filter((id) => id !== p.id)
                          : [...value.providers, p.id],
                      })
                    }
                    className="accent-blue-600"
                  />
                  <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: p.color_hex }} aria-hidden="true" />
                  <span className="truncate">{p.name}</span>
                </label>
              ))}
          </Group>
          {active > 0 && (
            <button
              type="button"
              className="mt-2 w-full text-xs font-semibold hover:underline"
              style={{ color: "var(--color-primary)" }}
              onClick={() => onChange(DEFAULT_FILTER)}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend
        className="px-1 mb-1 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-subtle-foreground)" }}
      >
        {title}
      </legend>
      {children}
    </fieldset>
  );
}
