"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Pencil, Plus, Stethoscope } from "lucide-react";
import { useAppointmentTypes, useSaveAppointmentType } from "@/lib/api/appointments";
import { initials } from "@/lib/utils/alphabet";
import { peso } from "@/lib/utils/money";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { FormError } from "@/components/ui/form";
import { ServiceModal } from "@/components/services/ServiceModal";
import type { AppointmentType } from "@/types/api";

/** Which service the modal is open for: "new", one to edit, or none. */
type Editing = { service: AppointmentType | null; key: number } | null;

type SortKey = "name" | "length" | "price";

/** Sort values; a service with no price sorts last whichever way the column runs. */
const sortValue: Record<SortKey, (t: AppointmentType) => string | number | null> = {
  name: (t) => t.name.toLowerCase(),
  length: (t) => t.duration_minutes,
  price: (t) => t.price,
};

/**
 * The clinic's services — the same list booking calls appointment types — with
 * their prices. A service is deactivated, never deleted: past appointments
 * still point at it.
 */
export default function ServicesPage() {
  const { data: types = [], isLoading, isError } = useAppointmentTypes();
  const toggle = useSaveAppointmentType();
  const [editing, setEditing] = useState<Editing>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  // Active first, then by the sorted column.
  const value = sortValue[sort.key];
  const rows = [...types].sort((a, b) => {
    if (a.is_active !== b.is_active) return Number(b.is_active) - Number(a.is_active);
    const x = value(a);
    const y = value(b);
    if (x === y) return a.name.localeCompare(b.name);
    if (x === null) return 1;
    if (y === null) return -1;
    return x < y ? -sort.dir : sort.dir;
  });
  const activeCount = types.filter((t) => t.is_active).length;

  function sortBy(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  const edit = (t: AppointmentType) => setEditing({ service: t, key: Date.now() });
  const addNew = () => setEditing({ service: null, key: Date.now() });

  return (
    <>
      {/* Title and toolbar, laid out like the Patient List's. */}
      <div className="flex flex-wrap items-end gap-3 shrink-0">
        <div className="flex-1 min-w-60">
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
            Services
          </h1>
          {/* The count under the title, like the Patient List's. */}
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
            {isLoading ? "Loading services…" : `${rows.length} service${rows.length === 1 ? "" : "s"} · ${activeCount} active`}
          </p>
        </div>
        <button className="btn btn-primary shrink-0" onClick={addNew}>
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
          New Service
        </button>
      </div>

      <div className="card-premium overflow-hidden flex flex-col">
        {isError ? (
          <p className="px-5 py-6 text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
            The services could not be loaded. Reload the page to try again.
          </p>
        ) : isLoading ? (
          <div className="p-5 space-y-4" aria-busy="true">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="rounded-full" style={{ width: 36, height: 36 }} />
                <Skeleton className="h-4" style={{ width: 160 }} />
                <Skeleton className="h-4" style={{ width: 80 }} />
                <Skeleton className="h-4 ml-auto" style={{ width: 120 }} />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No services yet"
            description="Add the services your clinic offers and their prices."
            action={
              <button onClick={addNew} className="btn btn-primary">
                <Plus size={14} aria-hidden="true" /> Add Service
              </button>
            }
          />
        ) : (
          <>
            {/* Phones: one card per service instead of the wide table. */}
            <ul className="md:hidden flex-auto min-h-[160px] overflow-auto">
              {rows.map((t) => (
                <li
                  key={t.id}
                  className="patient-row flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: "1px solid var(--color-border)", opacity: t.is_active ? 1 : 0.6 }}
                >
                  <ServiceBadge service={t} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--color-foreground)" }}>
                      {t.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
                      {t.duration_minutes} min · {t.is_block_time ? "Block time" : t.price === null ? "No set price" : peso(t.price)}
                    </p>
                  </div>
                  <StatusChip active={t.is_active} />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm shrink-0"
                    onClick={() => edit(t)}
                    aria-label={`Edit ${t.name}`}
                  >
                    <Pencil size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden md:block flex-auto min-h-[160px] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead className="sticky-head">
                  <tr>
                    <th className="w-16" aria-label="Colour" />
                    <SortHeader label="Service" active={sort.key === "name"} dir={sort.dir} onClick={() => sortBy("name")} />
                    <SortHeader label="Length" active={sort.key === "length"} dir={sort.dir} onClick={() => sortBy("length")} />
                    <SortHeader label="Price" active={sort.key === "price"} dir={sort.dir} onClick={() => sortBy("price")} />
                    <Th>Status</Th>
                    <th><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr
                      key={t.id}
                      className="patient-row"
                      style={{ borderBottom: "1px solid var(--color-border)", opacity: t.is_active ? 1 : 0.6 }}
                    >
                      <td className="pl-4 py-3">
                        <ServiceBadge service={t} />
                      </td>
                      <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-foreground)" }}>
                        {t.name}
                        {t.is_block_time && <span className="chip chip-completed ml-1.5 !py-0 !text-[11px]">Block time</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--color-foreground)" }}>
                        {t.duration_minutes} min
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium" style={{ color: "var(--color-foreground)" }}>
                        {t.price === null ? (
                          <span style={{ color: "var(--color-subtle-foreground)" }} aria-label="No set price">
                            —
                          </span>
                        ) : (
                          peso(t.price)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip active={t.is_active} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-full px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--color-surface-subtle)] disabled:opacity-50"
                          style={{ color: "var(--color-muted-foreground)" }}
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ id: t.id, is_active: !t.is_active })}
                        >
                          {t.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold hover:bg-[var(--color-primary-light)]"
                          style={{ color: "var(--color-primary)" }}
                          onClick={() => edit(t)}
                          aria-label={`Edit ${t.name}`}
                        >
                          Edit Service <span aria-hidden="true">→</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </>
        )}
        <div className="px-4 empty:hidden">
          <FormError error={toggle.error} />
        </div>
      </div>

      {editing && (
        <ServiceModal key={editing.key} open service={editing.service} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

/** The service's calendar colour as a round badge with its initials, like a patient's avatar. */
function ServiceBadge({ service }: { service: AppointmentType }) {
  return (
    <div
      className="flex items-center justify-center rounded-full font-bold shrink-0"
      style={{
        width: 36,
        height: 36,
        background: `color-mix(in srgb, ${service.color_hex} 16%, transparent)`,
        color: service.color_hex,
        fontSize: "0.75rem",
      }}
      aria-hidden="true"
    >
      {initials(service.name)}
    </div>
  );
}

function StatusChip({ active }: { active: boolean }) {
  return (
    <span className={`chip ${active ? "chip-confirmed" : "chip-completed"} !py-0 !text-[11px] shrink-0`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap"
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
      className="px-4 py-3 text-left whitespace-nowrap"
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
