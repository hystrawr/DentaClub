"use client";

import { useState } from "react";
import { Plus, Stethoscope } from "lucide-react";
import { useAppointmentTypes, useSaveAppointmentType } from "@/lib/api/appointments";
import { peso } from "@/lib/utils/money";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { FormError } from "@/components/ui/form";
import { ServiceModal } from "@/components/settings/ServiceModal";
import type { AppointmentType } from "@/types/api";

/** Which service the modal is open for: "new", one to edit, or none. */
type Editing = { service: AppointmentType | null; key: number } | null;

/**
 * The clinic's services — the same list booking calls appointment types — with
 * their prices. A service is deactivated, never deleted: past appointments
 * still point at it.
 */
export default function ServicesSettingsPage() {
  const { data: types = [], isLoading, isError } = useAppointmentTypes();
  const toggle = useSaveAppointmentType();
  const [editing, setEditing] = useState<Editing>(null);

  // Active first, then by name.
  const rows = [...types].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name));

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <p className="flex-1 min-w-60 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          Services are booked as appointment types. Their price fills in on the Treatment sheet, where it can still be
          changed for a discount.
        </p>
        <button className="btn btn-primary" onClick={() => setEditing({ service: null, key: Date.now() })}>
          <Plus size={15} strokeWidth={2.5} aria-hidden="true" />
          New Service
        </button>
      </div>

      <div className="card-premium overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="p-6 text-sm" style={{ color: "var(--color-destructive)" }}>
            The services could not be loaded. Reload the page to try again.
          </p>
        ) : rows.length === 0 ? (
          <EmptyState icon={Stethoscope} title="No services yet" description="Add the services your clinic offers and their prices." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <Th>Service</Th>
                  <Th>Length</Th>
                  <Th align="right">Price</Th>
                  <Th>Status</Th>
                  <th className="sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    style={{ borderBottom: "1px solid var(--color-border)", opacity: t.is_active ? 1 : 0.55 }}
                  >
                    <td className="px-4 py-3 font-semibold" style={{ color: "var(--color-foreground)" }}>
                      <span className="inline-flex items-center gap-2">
                        <span aria-hidden="true" className="rounded-full" style={{ width: 10, height: 10, background: t.color_hex }} />
                        {t.name}
                        {t.is_block_time && (
                          <span className="text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                            · Block time
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--color-foreground)" }}>
                      {t.duration_minutes} min
                    </td>
                    <td className="px-4 py-3 text-right font-mono" style={{ color: "var(--color-foreground)" }}>
                      {t.price === null ? <span style={{ color: "var(--color-subtle-foreground)" }}>—</span> : peso(t.price)}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--color-muted-foreground)" }}>
                      {t.is_active ? "Active" : "Inactive"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setEditing({ service: t, key: Date.now() })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ id: t.id, is_active: !t.is_active })}
                      >
                        {t.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-4 py-3 text-xs font-medium whitespace-nowrap"
      style={{ color: "var(--color-muted-foreground)", textAlign: align }}
    >
      {children}
    </th>
  );
}
