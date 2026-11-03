"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal, UserPlus, Users, X } from "lucide-react";
import { usePatients } from "@/lib/api/patients";
import { useProviders } from "@/lib/api/appointments";
import { initials } from "@/lib/utils/alphabet";
import { clock, dateOf, manilaToday, numericDate, timeOf } from "@/lib/utils/manila";
import { FilterFooter, FilterPanel, Group, Option, sameFilter } from "@/components/schedule/AppointmentFilter";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import type { PatientListItem, PatientVisit } from "@/types/api";

const PAGE_SIZE = 20;

type SortKey = "last" | "first" | "visit" | "appointment";
type AppointmentFilter = "all" | "has" | "none";
/** Current patients, or the ones removed from the directory (to look up or restore). */
type StatusFilter = "active" | "inactive";

/**
 * What the list shows. Like the schedule's filter, ticking a dentist narrows to
 * them, and no dentist ticked means every dentist.
 */
export interface PatientFilter {
  status: StatusFilter;
  appointment: AppointmentFilter;
  providers: string[];
}

/** No filter: every current patient, whatever their appointment or dentist. What "Reset" goes back to. */
const DEFAULT_FILTER: PatientFilter = { status: "active", appointment: "all", providers: [] };

const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: "active", label: "Current patients" },
  { key: "inactive", label: "Removed patients" },
];

const APPOINTMENT_OPTIONS: Array<{ key: AppointmentFilter; label: string }> = [
  { key: "all", label: "All patients" },
  { key: "has", label: "Has an upcoming appointment" },
  { key: "none", label: "No upcoming appointment" },
];

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** The dentist a patient is seeing next, or saw last. */
const doctorOf = (p: PatientListItem) => (p.next_appointment ?? p.last_visit)?.provider ?? null;

/**
 * Whether a patient passes the appointment choice and dentist ticks (status is
 * filtered on the server). Once a dentist is ticked, only their patients show,
 * so patients with no dentist yet drop out, as unassigned appointments do on the schedule.
 */
function matchesPatientFilter(filter: PatientFilter, p: PatientListItem): boolean {
  if (filter.appointment === "has" && !p.next_appointment) return false;
  if (filter.appointment === "none" && p.next_appointment) return false;
  if (filter.providers.length === 0) return true;
  const doctor = doctorOf(p);
  return doctor !== null && filter.providers.includes(doctor.id);
}

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
      .filter((p) => matchesPatientFilter(filter, p))
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
  const filtered =
    Boolean(search) || filter.status !== "active" || filter.appointment !== "all" || filter.providers.length > 0;
  const today = manilaToday();

  // Any change to what is shown starts back on the first page.
  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
    setPage(0);
  }

  function applyFilter(next: PatientFilter) {
    setFilter(next);
    setPage(0);
  }

  // The page is as tall as the screen: the title stays put, and when the list is
  // longer than the room left, the rows scroll inside the card (see .sticky-head).
  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      {/* Title and toolbar */}
      <div className="flex flex-wrap items-end gap-3 shrink-0">
        <div className="flex-1 min-w-48">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
            Patient List
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            {isLoading ? "Loading patients…" : `${rows.length} patient${rows.length === 1 ? "" : "s"}${filtered ? " found" : ""}`}
          </p>
        </div>

        <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-2 px-3 rounded-full flex-1 min-w-0 sm:flex-none sm:w-64"
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
                <button onClick={() => setQuery("")} aria-label="Clear search" className="rounded-full p-0.5 hover:bg-[var(--color-surface-subtle)]">
                  <X size={12} style={{ color: "var(--color-subtle-foreground)" }} />
                </button>
              )
            )}
          </div>

          <PatientFilterMenu value={filter} onChange={applyFilter} />

          <button className="btn btn-primary shrink-0" onClick={onAddPatient} aria-label="New Patient">
            <UserPlus size={15} aria-hidden="true" />
            <span className="hidden sm:inline">New Patient</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card-premium overflow-hidden flex flex-col">
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
            {/* Phones and narrow windows: one row per patient instead of the wide table. */}
            <ul className="lg:hidden flex-auto min-h-[160px] overflow-y-auto">
              {shown.map((p) => {
                const doctor = doctorOf(p);
                const isToday = p.next_appointment !== null && dateOf(p.next_appointment.start) === today;
                return (
                  <li key={p.id} className="patient-row" style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <Link
                      href={`/patients/${p.id}/info` as Route}
                      className="flex items-center gap-3 px-4 py-3"
                      aria-label={`View patient record of ${p.first_name} ${p.last_name}`}
                    >
                      <div
                        className="flex items-center justify-center rounded-full font-bold shrink-0"
                        style={{ width: 36, height: 36, background: "var(--color-primary-light)", color: "var(--color-primary)", fontSize: "0.75rem" }}
                        aria-hidden="true"
                      >
                        {initials(`${p.first_name} ${p.last_name}`)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: "var(--color-foreground)" }}>
                          {p.last_name}, {p.first_name}
                          {filter.status === "inactive" && (
                            <span className="chip ml-1.5 !py-0 !text-[11px]" style={{ background: "var(--color-warning-light)", color: "var(--color-warning)" }}>
                              Inactive
                            </span>
                          )}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
                          {p.next_appointment
                            ? `Next: ${numericDate(dateOf(p.next_appointment.start))}, ${clock(timeOf(p.next_appointment.start))}`
                            : p.last_visit
                              ? `Last visit: ${numericDate(dateOf(p.last_visit.start))}`
                              : "No visits yet"}
                          {doctor && ` · ${doctor.name}`}
                        </p>
                      </div>
                      {isToday && <span className="chip chip-scheduled !py-0 !text-[11px] shrink-0">Today</span>}
                      <ChevronRight size={16} className="shrink-0" style={{ color: "var(--color-subtle-foreground)" }} aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* From 1024px the columns fit the card, so it only ever scrolls up and down. */}
            <div className="hidden lg:block flex-auto min-h-[160px] overflow-y-auto overflow-x-hidden">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky-head">
                  <tr>
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
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => {
                    const doctor = doctorOf(p);
                    const isToday = p.next_appointment !== null && dateOf(p.next_appointment.start) === today;
                    return (
                      <tr key={p.id} className="patient-row" style={{ borderBottom: "1px solid var(--color-border)" }}>
                        <td className="pl-4 py-3">
                          <div
                            className="flex items-center justify-center rounded-full font-bold"
                            style={{
                              width: 36,
                              height: 36,
                              background: "var(--color-primary-light)",
                              color: "var(--color-primary)",
                              fontSize: "0.75rem",
                            }}
                            aria-hidden="true"
                          >
                            {initials(`${p.first_name} ${p.last_name}`)}
                          </div>
                        </td>
                        <td className="px-3 xl:px-4 py-3 font-semibold" style={{ color: "var(--color-foreground)" }}>
                          {p.last_name}
                          {filter.status === "inactive" && (
                            <span className="chip ml-1.5 !py-0 !text-[11px]" style={{ background: "var(--color-warning-light)", color: "var(--color-warning)" }}>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-3 xl:px-4 py-3" style={{ color: "var(--color-foreground)" }}>
                          {p.first_name}
                        </td>
                        <td className="px-3 xl:px-4 py-3">
                          <When visit={p.last_visit} />
                        </td>
                        <td className="px-3 xl:px-4 py-3">
                          <When visit={p.next_appointment} isToday={isToday} />
                        </td>
                        <td className="px-3 xl:px-4 py-3">
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
                        <td className="px-3 xl:px-4 py-3 text-right whitespace-nowrap">
                          <Link
                            href={`/patients/${p.id}/info` as Route}
                            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--color-primary-light)]"
                            style={{ color: "var(--color-primary)" }}
                            aria-label={`View patient record of ${p.first_name} ${p.last_name}`}
                          >
                            {/* Shorter where the table is narrow (1024–1279px), so every column fits. */}
                            <span className="hidden xl:inline">View Patient Record</span>
                            <span className="xl:hidden">View record</span> <span aria-hidden="true">→</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* The count is under the title; this bar only appears when there is a page 2 to reach. */}
            {pages > 1 && (
              <div
                className="flex items-center justify-end px-4 py-3 text-[13px] shrink-0"
                style={{ background: "var(--color-surface-raised)", color: "var(--color-muted-foreground)", borderTop: "1px solid var(--color-border)" }}
              >
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-3 xl:px-4 py-3 text-left text-xs font-medium whitespace-nowrap"
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
      className="px-3 xl:px-4 py-3 text-left whitespace-nowrap"
      aria-sort={active ? (dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-xs font-medium hover:text-[var(--color-foreground)]"
        style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
      >
        {label}
        <Icon size={12} style={{ opacity: active ? 1 : 0.4 }} aria-hidden="true" />
      </button>
    </th>
  );
}

/** A visit's date with the time beneath, or a grey dash when there is none. */
function When({ visit, isToday = false }: { visit: PatientVisit | null; isToday?: boolean }) {
  if (!visit) {
    return (
      <span style={{ color: "var(--color-subtle-foreground)" }} aria-label="None">
        —
      </span>
    );
  }
  return (
    <div className="whitespace-nowrap">
      <div className="font-medium" style={{ color: "var(--color-foreground)" }}>
        {numericDate(dateOf(visit.start))}
      </div>
      {/* "Today" rides on the time line, so the column stays as narrow as a date. */}
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
        {clock(timeOf(visit.start))}
        {isToday && <span className="chip chip-scheduled !py-0 !text-[11px]">Today</span>}
      </div>
    </div>
  );
}

/**
 * The Filter button and its menu: current or removed patients, upcoming
 * appointment or not, and which dentist. Like the schedule's filter, the ticks
 * change a working copy and the list changes on Apply.
 */
function PatientFilterMenu({ value, onChange }: { value: PatientFilter; onChange: (next: PatientFilter) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  const providers = useProviders();

  function apply() {
    onChange(draft);
    setOpen(false);
  }

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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="btn btn-secondary btn-filter"
        onClick={() => {
          // Each opening starts from what the list shows now.
          if (!open) setDraft(value);
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filter
      </button>

      {open && (
        <FilterPanel
          width="w-72"
          footer={
            <FilterFooter
              onReset={() => setDraft(DEFAULT_FILTER)}
              resetDisabled={sameFilter(draft, DEFAULT_FILTER)}
              onCancel={() => setOpen(false)}
              onApply={apply}
              applyDisabled={sameFilter(draft, value)}
            />
          }
        >
          <Group title="Patients">
            {STATUS_OPTIONS.map((o) => (
              <Option
                key={o.key}
                name="patient-status-filter"
                label={o.label}
                checked={draft.status === o.key}
                onChange={() => setDraft((d) => ({ ...d, status: o.key }))}
              />
            ))}
          </Group>
          <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
          <Group title="Appointment">
            {APPOINTMENT_OPTIONS.map((o) => (
              <Option
                key={o.key}
                name="patient-appointment-filter"
                label={o.label}
                checked={draft.appointment === o.key}
                onChange={() => setDraft((d) => ({ ...d, appointment: o.key }))}
              />
            ))}
          </Group>
          <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
          <Group title="Dentist" note={draft.providers.length === 0 ? "All dentists" : undefined}>
            {providers.isLoading && (
              <p className="px-1 py-1.5 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                Loading…
              </p>
            )}
            {providers.data
              ?.filter((p) => p.is_active)
              .map((p) => (
                <Option
                  key={p.id}
                  label={p.name}
                  swatch={p.color_hex}
                  checked={draft.providers.includes(p.id)}
                  onChange={() => setDraft((d) => ({ ...d, providers: toggle(d.providers, p.id) }))}
                />
              ))}
          </Group>
        </FilterPanel>
      )}
    </div>
  );
}
