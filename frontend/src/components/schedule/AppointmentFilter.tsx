"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useProviders } from "@/lib/api/appointments";
import type { Appointment, AppointmentStatus } from "@/types/api";

/** Statuses grouped the way the front desk thinks about them. */
export const STATUS_GROUPS: Array<{ key: string; label: string; statuses: AppointmentStatus[] }> = [
  { key: "booked", label: "Scheduled / Confirmed", statuses: ["scheduled", "confirmed"] },
  { key: "here", label: "Arrived / In chair", statuses: ["arrived", "in_chair"] },
  { key: "done", label: "Completed", statuses: ["completed"] },
  { key: "released", label: "Cancelled / No-show", statuses: ["cancelled", "no_show"] },
];

/**
 * What the schedule hides. Stored as exclusions, so a dentist added later
 * shows up without anyone having to tick them.
 */
export interface ScheduleFilter {
  hiddenProviders: string[];
  hiddenGroups: string[];
}

/** Cancelled and no-show appointments only clutter the week, so they start hidden. */
export const DEFAULT_FILTER: ScheduleFilter = { hiddenProviders: [], hiddenGroups: ["released"] };

export function matchesFilter(filter: ScheduleFilter, apt: Appointment): boolean {
  if (apt.provider && filter.hiddenProviders.includes(apt.provider.id)) return false;
  const group = STATUS_GROUPS.find((g) => g.statuses.includes(apt.status));
  return !group || !filter.hiddenGroups.includes(group.key);
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

/** The Filter button and its menu: which dentists and which statuses the calendar shows. */
export function AppointmentFilter({ value, onChange }: { value: ScheduleFilter; onChange: (next: ScheduleFilter) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const providers = useProviders();
  const listed = (providers.data ?? []).filter((p) => p.is_active).map((p) => p.id);
  const anyHidden = value.hiddenProviders.length + value.hiddenGroups.length > 0;
  const anyShown =
    listed.some((id) => !value.hiddenProviders.includes(id)) || STATUS_GROUPS.some((g) => !value.hiddenGroups.includes(g.key));

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
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filter
      </button>

      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-2xl p-3"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", boxShadow: "var(--shadow-dropdown)" }}
        >
          <Group title="Dentist">
            {providers.isLoading && <p className="px-1 py-1.5 text-xs" style={{ color: "var(--color-muted-foreground)" }}>Loading…</p>}
            {providers.data?.filter((p) => p.is_active).map((p) => (
              <Option
                key={p.id}
                label={p.name}
                swatch={p.color_hex}
                checked={!value.hiddenProviders.includes(p.id)}
                onChange={() => onChange({ ...value, hiddenProviders: toggle(value.hiddenProviders, p.id) })}
              />
            ))}
          </Group>
          <hr className="my-2" style={{ borderColor: "var(--color-border)" }} />
          <Group title="Status">
            {STATUS_GROUPS.map((g) => (
              <Option
                key={g.key}
                label={g.label}
                checked={!value.hiddenGroups.includes(g.key)}
                onChange={() => onChange({ ...value, hiddenGroups: toggle(value.hiddenGroups, g.key) })}
              />
            ))}
          </Group>
          <div className="mt-2 pt-2 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--color-border)" }}>
            <button
              type="button"
              className="filter-action"
              style={{ color: "var(--color-muted-foreground)" }}
              disabled={!anyShown}
              onClick={() => onChange({ hiddenProviders: listed, hiddenGroups: STATUS_GROUPS.map((g) => g.key) })}
            >
              Clear all
            </button>
            <button
              type="button"
              className="filter-action"
              style={{ color: "var(--color-primary)" }}
              disabled={!anyHidden}
              onClick={() => onChange({ hiddenProviders: [], hiddenGroups: [] })}
            >
              Show everything
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** A titled section of a Filter menu. Shared with the patient list's filter. */
export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="px-1 mb-1 text-xs font-medium" style={{ color: "var(--color-subtle-foreground)" }}>
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

/** One row of a Filter menu; a radio when `name` is given, otherwise a checkbox. */
export function Option({ label, swatch, checked, onChange, name }: { label: string; swatch?: string; checked: boolean; onChange: () => void; name?: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm cursor-pointer filter-option" style={{ color: "var(--color-foreground)" }}>
      <input type={name ? "radio" : "checkbox"} name={name} checked={checked} onChange={onChange} className="accent-[var(--color-primary)]" />
      {swatch && <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: swatch }} aria-hidden="true" />}
      <span className="truncate">{label}</span>
    </label>
  );
}
