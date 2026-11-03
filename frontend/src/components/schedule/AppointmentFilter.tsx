"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useProviders } from "@/lib/api/appointments";
import type { Appointment, AppointmentStatus } from "@/types/api";

/** Statuses grouped the way the front desk thinks about them. */
const STATUS_GROUPS: Array<{ key: string; label: string; statuses: AppointmentStatus[] }> = [
  { key: "booked", label: "Scheduled / Confirmed", statuses: ["scheduled", "confirmed"] },
  { key: "here", label: "Arrived / In chair", statuses: ["arrived", "in_chair"] },
  { key: "done", label: "Completed", statuses: ["completed"] },
  { key: "released", label: "Cancelled / No-show", statuses: ["cancelled", "no_show"] },
];

/**
 * What the schedule narrows to. Ticking a box narrows to it; a section with
 * nothing ticked shows everything, so a dentist added later shows up untouched.
 */
export interface ScheduleFilter {
  providers: string[];
  groups: string[];
}

/** Nothing ticked: every dentist and every status. What "Reset" goes back to. */
export const DEFAULT_FILTER: ScheduleFilter = { providers: [], groups: [] };

export function matchesFilter(filter: ScheduleFilter, apt: Appointment): boolean {
  if (filter.providers.length > 0 && !(apt.provider && filter.providers.includes(apt.provider.id))) return false;
  const group = STATUS_GROUPS.find((g) => g.statuses.includes(apt.status));
  return filter.groups.length === 0 || (group !== undefined && filter.groups.includes(group.key));
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/**
 * Whether two filters say the same thing. Lists are compared as sets, so
 * unticking a box and ticking it again counts as no change.
 */
export function sameFilter<T extends object>(a: T, b: T): boolean {
  const norm = (f: T) =>
    JSON.stringify(Object.entries(f).map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v]));
  return norm(a) === norm(b);
}

/**
 * The Filter button and its menu: which dentists and which statuses the calendar shows.
 *
 * Ticking a box only changes the menu's working copy (`draft`); the calendar
 * changes when Apply is pressed. Cancel, a click outside or Escape drop it.
 */
export function AppointmentFilter({ value, onChange }: { value: ScheduleFilter; onChange: (next: ScheduleFilter) => void }) {
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
          // Each opening starts from what the calendar shows now.
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
          width="w-64"
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
          <Group title="Dentist" note={draft.providers.length === 0 ? "All dentists" : undefined}>
            {providers.isLoading && <p className="px-1 py-1.5 text-xs" style={{ color: "var(--color-muted-foreground)" }}>Loading…</p>}
            {providers.data?.filter((p) => p.is_active).map((p) => (
              <Option
                key={p.id}
                label={p.name}
                swatch={p.color_hex}
                checked={draft.providers.includes(p.id)}
                onChange={() => setDraft((d) => ({ ...d, providers: toggle(d.providers, p.id) }))}
              />
            ))}
          </Group>
          <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
          <Group title="Status" note={draft.groups.length === 0 ? "All statuses" : undefined}>
            {STATUS_GROUPS.map((g) => (
              <Option
                key={g.key}
                label={g.label}
                checked={draft.groups.includes(g.key)}
                onChange={() => setDraft((d) => ({ ...d, groups: toggle(d.groups, g.key) }))}
              />
            ))}
          </Group>
        </FilterPanel>
      )}
    </div>
  );
}

/**
 * A Filter menu's dropdown. Its options scroll inside it, and its footer stays
 * at the bottom, so Apply is always in view however long the dentist list.
 * Shared with the patient list's filter.
 */
export function FilterPanel({ width, footer, children }: { width: string; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={`absolute right-0 z-30 mt-2 ${width} max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col rounded-2xl overflow-hidden`}
      style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
    >
      <div className="min-h-0 overflow-y-auto p-3">{children}</div>
      <div className="shrink-0 px-3 pb-3 pt-2" style={{ borderTop: "1px solid var(--color-border)" }}>
        {footer}
      </div>
    </div>
  );
}

/**
 * A Filter menu's foot: "Reset" (back to the ticks the page starts with),
 * then Cancel and Apply. Nothing on the screen changes until Apply.
 */
export function FilterFooter({
  onReset,
  resetDisabled,
  onCancel,
  onApply,
  applyDisabled,
}: {
  onReset: () => void;
  /** True while the ticks already match the page's starting ones. */
  resetDisabled: boolean;
  onCancel: () => void;
  onApply: () => void;
  /** True while the ticks match what is already applied. */
  applyDisabled: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-end">
        <button
          type="button"
          className="filter-action shrink-0"
          style={{ color: "var(--color-primary)" }}
          disabled={resetDisabled}
          onClick={onReset}
        >
          Reset
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary btn-sm flex-1" onClick={onApply} disabled={applyDisabled}>
          Apply
        </button>
      </div>
    </>
  );
}

/**
 * A titled section of a Filter menu. `note` sits beside the title, e.g. "All
 * dentists" while nothing in the section is ticked. Shared with the patient list's filter.
 */
export function Group({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="px-1 mb-1 text-xs font-medium" style={{ color: "var(--color-subtle-foreground)" }}>
        {title}
        {note && <span className="font-normal" style={{ color: "var(--color-muted-foreground)" }}> · {note}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

/** One row of a Filter menu; a radio when `name` is given, otherwise a checkbox. */
export function Option({ label, swatch, checked, onChange, name }: { label: string; swatch?: string; checked: boolean; onChange: () => void; name?: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm cursor-pointer filter-option" style={{ color: "var(--color-foreground)" }}>
      <input type={name ? "radio" : "checkbox"} name={name} checked={checked} onChange={onChange} className="accent-primary" />
      {swatch && <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: swatch }} aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </label>
  );
}
