"use client";

import { useState } from "react";
import { useOperatories, useTodayOperatoryBoard } from "@/lib/api/appointments";
import { styleFor } from "@/lib/utils/appointment-status";
import { timeOf } from "@/lib/utils/manila";
import type { AppointmentStatus, BoardItem } from "@/types/api";
import { AppointmentSheet } from "./AppointmentSheet";
import { EmptyOperatorySlot, PatientCard } from "./PatientCard";

/**
 * Today's queue, one column per chair (from DentalOS's OperatoryBoard).
 *
 * The board API only lists chairs that have appointments, so DentalOS's empty
 * column could never actually render. Here every active chair is shown in its
 * board order, empty ones included, with "Unassigned" last — an unassigned
 * patient is exactly the one the front desk needs to see.
 */
export function OperatoryBoard() {
  const [selected, setSelected] = useState<string | null>(null);
  const board = useTodayOperatoryBoard();
  const chairs = useOperatories();

  if (board.isLoading || chairs.isLoading) {
    return (
      <div className="flex gap-3 p-1" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton shrink-0" style={{ width: 240, height: 220 }} />
        ))}
      </div>
    );
  }

  if (board.isError) {
    return (
      <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
        The queue could not be loaded. Check that the backend is running — it refreshes every 30 seconds.
      </p>
    );
  }

  const data = board.data ?? {};
  // Active chairs in board order, then any other chair with appointments today
  // (e.g. one retired since), then Unassigned when anyone is in it.
  const chairNames = (chairs.data ?? []).map((c) => c.name);
  const others = Object.keys(data).filter((n) => !chairNames.includes(n) && n !== "Unassigned");
  const columns = [...chairNames, ...others, ...(data.Unassigned?.length ? ["Unassigned"] : [])].map((name) => ({
    name,
    items: data[name] ?? [],
  }));

  const all = Object.values(data).flat();

  return (
    <>
      <Summary items={all} />

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => (
          <div key={col.name} className="flex flex-col gap-3 shrink-0" style={{ width: 240 }}>
            <div className="flex items-center justify-between rounded-2xl px-3 py-2" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              <p className="text-xs font-semibold" style={{ color: "var(--color-foreground)" }}>
                {col.name}
              </p>
              <span className="text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
                {col.items.length}
              </span>
            </div>

            {col.items.length === 0 ? (
              <EmptyOperatorySlot />
            ) : (
              col.items.map((item) => (
                <PatientCard
                  key={item.id}
                  patientName={item.patient_name ?? "Blocked time"}
                  appointmentType={item.appointment_type_name ?? "—"}
                  scheduledStart={timeOf(item.scheduled_start)}
                  status={item.status}
                  onTap={() => setSelected(item.id)}
                />
              ))
            )}
          </div>
        ))}
      </div>

      {selected && <AppointmentSheet key={selected} appointmentId={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

/** At-a-glance counts: who is still coming, who is waiting, who is in a chair. */
function Summary({ items }: { items: BoardItem[] }) {
  const count = (...statuses: AppointmentStatus[]) => items.filter((i) => statuses.includes(i.status)).length;
  const waiting = items
    .filter((i) => i.status === "arrived")
    .sort((a, b) => a.scheduled_start.localeCompare(b.scheduled_start));

  const tiles: Array<{ label: string; value: number; status: AppointmentStatus }> = [
    { label: "Still to come", value: count("scheduled", "confirmed"), status: "confirmed" },
    { label: "Waiting room", value: waiting.length, status: "arrived" },
    { label: "In the chair", value: count("in_chair"), status: "in_chair" },
    { label: "Done", value: count("completed"), status: "completed" },
  ];

  return (
    <div className="space-y-3 mb-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="card-premium px-4 py-3" style={{ borderTop: `3px solid ${styleFor(t.status).dot}` }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle-foreground)" }}>
              {t.label}
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--color-foreground)" }}>
              {t.value}
            </p>
          </div>
        ))}
      </div>
      {waiting.length > 0 && (
        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          <strong style={{ color: "var(--color-foreground)" }}>Next to seat:</strong>{" "}
          {waiting.map((w, i) => `${i + 1}. ${w.patient_name ?? "—"} (${timeOf(w.scheduled_start)})`).join("   ")}
        </p>
      )}
    </div>
  );
}
