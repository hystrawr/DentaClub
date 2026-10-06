"use client";

import { use, useState } from "react";
import { Cake, Heart, Mail, MapPin, Pencil, Phone, StickyNote } from "lucide-react";
import { EditPatientDialog } from "@/components/frontdesk/EditPatientDialog";
import { usePatient } from "@/lib/api/patients";

/**
 * The patient overview (from DentalOS).
 *
 * The rule, applied to every field: **a missing answer is rendered as a missing
 * answer** — "Not recorded", never a blank and never a placeholder value.
 */
export default function PatientOverviewPage({ params }: PageProps<"/patients/[id]/overview">) {
  const { id } = use(params);
  const patient = usePatient(id);
  const [editing, setEditing] = useState(false);
  const p = patient.data;

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">
        <Section
          title="Contact Information"
          loading={patient.isLoading}
          error={patient.isError}
          action={<EditButton label="Edit patient" onClick={() => setEditing(true)} />}
        >
          <div className="space-y-3">
            <InfoRow icon={Phone} label="Mobile" value={p?.mobile} />
            <InfoRow icon={Mail} label="Email" value={p?.email} />
            <InfoRow icon={MapPin} label="Address" value={p?.address} />
          </div>
        </Section>

        <Section title="Details" loading={patient.isLoading} error={patient.isError}>
          <div className="space-y-3">
            <InfoRow icon={Cake} label="Date of birth" value={p?.date_of_birth ? `${p.date_of_birth} (${p.age} yrs)` : null} />
            <InfoRow icon={Heart} label="Sex" value={p?.sex ? p.sex[0]!.toUpperCase() + p.sex.slice(1) : null} />
            <InfoRow icon={StickyNote} label="Notes" value={p?.notes} />
          </div>
        </Section>
      </div>

      {p && <EditPatientDialog patient={p} open={editing} onClose={() => setEditing(false)} />}
    </div>
  );
}

/* ─── Pieces (DentalOS's overview helpers) ──────────────────────── */

function Section({
  title,
  loading,
  error,
  action,
  children,
}: {
  title: string;
  loading: boolean;
  error: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
          {title}
        </h2>
        {/* No edit button until the section has loaded: editing over a failed
            read would show empty fields that look like recorded absences. */}
        {action && !loading && !error ? action : null}
      </div>
      <div className="p-5">
        {error ? (
          <p className="text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
            This could not be loaded. Do not treat what is on screen as complete.
          </p>
        ) : loading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton" style={{ height: 16, borderRadius: 6 }} />
            ))}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 shrink-0"
      style={{ color: "var(--color-primary)", border: "1px solid var(--color-border)" }}
    >
      <Pencil size={11} aria-hidden="true" />
      {label}
    </button>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex items-center justify-center rounded-xl shrink-0 mt-0.5"
        style={{ width: 32, height: 32, background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}
        aria-hidden="true"
      >
        <Icon size={14} style={{ color: "var(--color-muted-foreground)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
          {label}
        </p>
        {value ? (
          <p className="text-sm font-medium break-words whitespace-pre-line" style={{ color: "var(--color-foreground)" }}>
            {value}
          </p>
        ) : (
          <span className="text-sm" style={{ color: "var(--color-subtle-foreground)" }}>
            Not recorded
          </span>
        )}
      </div>
    </div>
  );
}
