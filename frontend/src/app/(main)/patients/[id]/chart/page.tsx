"use client";

import { History } from "lucide-react";
import { use } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ToothChart } from "@/components/odontogram/ToothChart";
import { useToothHistory, type OdontogramEvent } from "@/lib/api/odontogram";
import { conditionFor } from "@/lib/odontogram/conditions";
import { usePatient } from "@/lib/api/patients";

/**
 * The Dental Chart tab: the chart, and below it every event ever charted,
 * oldest first, including corrected and withdrawn ones.
 */
export default function PatientChartPage({ params }: PageProps<"/patients/[id]/chart">) {
  const { id } = use(params);
  const patient = usePatient(id);
  const history = useToothHistory(id);
  const events = history.data ?? [];

  return (
    <div className="pb-6">
      <div className="p-6">
        <ToothChart patientId={id} patientAge={patient.data?.age} variant="desk" />
      </div>

      <section>
        <div className="px-6 py-3" style={{ borderTop: "1px solid var(--color-border)", borderBottom: "1px solid var(--color-border)" }}>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            Chart History
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
            Every entry ever charted, newest first — corrections and retractions included
          </p>
        </div>

        {history.isLoading && (
          <div className="px-6 py-4 space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10 }} />
            ))}
          </div>
        )}

        {history.isError && (
          <p className="px-6 py-4 text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
            The chart history could not be loaded. Treat this list as unknown rather than empty.
          </p>
        )}

        {!history.isLoading && !history.isError && events.length === 0 && (
          <EmptyState icon={History} title="Nothing charted yet" description="Select a tooth above to record a finding." />
        )}

        {events.length > 0 && (
          <ul className="divide-y" style={{ borderBottom: "1px solid var(--color-border)" }}>
            {[...events].reverse().map((event) => (
              <HistoryRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_CHIP: Record<string, { label: string; className: string }> = {
  final: { label: "Current", className: "chip chip-confirmed" },
  corrected: { label: "Corrected", className: "chip chip-pending" },
  amended: { label: "Amended", className: "chip chip-scheduled" },
  "entered-in-error": { label: "Entered in error", className: "chip chip-cancelled" },
};

function HistoryRow({ event }: { event: OdontogramEvent }) {
  const retraction = event.supersession_type === "entered-in-error";
  const label = retraction
    ? "Retraction"
    : (conditionFor(event.condition_code ?? "")?.label ?? event.condition_code ?? "Finding");
  const surfaces = event.surfaces?.length ? event.surfaces.join("") : "Whole tooth";
  const chip = STATUS_CHIP[event.status] ?? STATUS_CHIP.final!;
  const withdrawn = event.status !== "final";

  return (
    <li className="px-6 py-3 flex items-start gap-4 table-row-hover">
      <span
        className="font-mono text-xs font-bold rounded-lg px-2 py-1 shrink-0"
        style={{ background: "var(--color-surface-subtle)", color: "var(--color-foreground)" }}
      >
        #{event.tooth_number}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-medium"
            style={{ color: "var(--color-foreground)", textDecoration: withdrawn ? "line-through" : undefined }}
          >
            {label}
          </span>
          <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            {surfaces}
          </span>
          <span className={chip.className}>{chip.label}</span>
          {event.replaces_event_id && (
            <span className="text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
              {event.supersession_type} of entry {event.replaces_event_id}
            </span>
          )}
        </div>
        {(event.notes || event.supersession_reason) && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
            {event.supersession_reason ?? event.notes}
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="text-xs font-mono" style={{ color: "var(--color-subtle-foreground)" }}>
          #{event.id} · {event.observed_at.slice(0, 10)}
        </p>
        {event.created_at.slice(0, 10) !== event.observed_at.slice(0, 10) && (
          <p className="text-[10px]" style={{ color: "var(--color-subtle-foreground)" }}>
            recorded {event.created_at.slice(0, 10)}
          </p>
        )}
      </div>
    </li>
  );
}
