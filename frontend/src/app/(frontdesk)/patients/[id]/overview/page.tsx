"use client";

import { use, useState } from "react";
import { Briefcase, Cake, Heart, Mail, MapPin, Pencil, Phone, StickyNote, UserRoundPlus, Users } from "lucide-react";
import { EditMedicalHistoryDialog } from "@/components/frontdesk/EditMedicalHistoryDialog";
import { EditPatientDialog } from "@/components/frontdesk/EditPatientDialog";
import { useMedicalHistory, usePatient } from "@/lib/api/patients";
import { MEDICAL_HISTORY, showGroup } from "@/lib/utils/medical-history";
import { dateOf, longDate } from "@/lib/utils/manila";
import type { MedicalHistory, Patient } from "@/types/api";

/**
 * The patient overview (from DentalOS).
 *
 * The rule, applied to every field: **a missing answer is rendered as a missing
 * answer** — "Not recorded", never a blank and never a placeholder value.
 */
export default function PatientOverviewPage({ params }: PageProps<"/patients/[id]/overview">) {
  const { id } = use(params);
  const patient = usePatient(id);
  const history = useMedicalHistory(id);
  const [editing, setEditing] = useState(false);
  const [editingHistory, setEditingHistory] = useState(false);
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
            <InfoRow icon={Heart} label="Sex" value={capitalize(p?.sex)} />
            <InfoRow icon={Users} label="Civil status" value={capitalize(p?.civil_status)} />
            <InfoRow icon={Briefcase} label="Occupation" value={p?.occupation} />
            <InfoRow icon={UserRoundPlus} label="Referred by" value={p?.referred_by} />
            <InfoRow icon={StickyNote} label="Notes" value={p?.notes} />
          </div>
        </Section>

        <div className="lg:col-span-2">
          <Section
            title="Medical History"
            subtitle={history.data?.updated_at ? `Last updated ${longDate(dateOf(history.data.updated_at))}` : undefined}
            loading={patient.isLoading || history.isLoading}
            error={patient.isError || history.isError}
            action={
              <EditButton
                label={history.data?.updated_at ? "Edit history" : "Record history"}
                onClick={() => setEditingHistory(true)}
              />
            }
          >
            {p && history.data && <MedicalHistoryView patient={p} history={history.data} />}
          </Section>
        </div>
      </div>

      {p && <EditPatientDialog patient={p} open={editing} onClose={() => setEditing(false)} />}
      {p && history.data && (
        <EditMedicalHistoryDialog
          patient={p}
          history={history.data}
          open={editingHistory}
          onClose={() => setEditingHistory(false)}
        />
      )}
    </div>
  );
}

const capitalize = (value: string | null | undefined) => (value ? value[0]!.toUpperCase() + value.slice(1) : null);

/* ─── Medical history ───────────────────────────────────────────── */

function MedicalHistoryView({ patient, history }: { patient: Patient; history: MedicalHistory }) {
  if (!history.updated_at) {
    return (
      <p className="text-sm" style={{ color: "var(--color-subtle-foreground)" }}>
        No medical history recorded yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
      {MEDICAL_HISTORY.filter((group) => showGroup(group, patient.sex, history)).map((group, i) => (
        <div key={group.title ?? i} className="space-y-1.5">
          {group.title && (
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-subtle-foreground)" }}>
              {group.title}
            </p>
          )}
          {group.questions.map((q) => (
            <div key={q.key}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: "var(--color-foreground)" }}>
                  {q.label}
                </span>
                <Answer value={history[q.key]} concern={history[q.key] !== null && history[q.key] === (q.concernIf ?? true)} />
              </div>
              {q.detail && history[q.detail.key] && <Detail label={q.detail.label} value={history[q.detail.key]!} />}
            </div>
          ))}
          {group.text?.map((t) => (
            <div key={t.key} className="flex items-start justify-between gap-3 pt-1">
              <span className="text-sm" style={{ color: "var(--color-foreground)" }}>
                {t.label}
              </span>
              {history[t.key] ? (
                <span className="text-sm font-medium text-right" style={{ color: "var(--color-foreground)" }}>
                  {history[t.key]}
                </span>
              ) : (
                <NotRecorded />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Yes / No, or "Not recorded" — never a blank. A concerning answer is highlighted. */
function Answer({ value, concern }: { value: boolean | null; concern: boolean }) {
  if (value === null) return <NotRecorded />;
  return (
    <span
      className="chip shrink-0"
      style={
        concern
          ? { background: "var(--color-amber-light)", color: "#92400E" }
          : { background: "var(--color-surface-subtle)", color: "var(--color-muted-foreground)" }
      }
    >
      {value ? "Yes" : "No"}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs mt-0.5 pl-3" style={{ color: "var(--color-muted-foreground)" }}>
      {label}: <span style={{ color: "var(--color-foreground)" }}>{value}</span>
    </p>
  );
}

function NotRecorded() {
  return (
    <span className="text-xs shrink-0" style={{ color: "var(--color-subtle-foreground)" }}>
      Not recorded
    </span>
  );
}

/* ─── Pieces (DentalOS's overview helpers) ──────────────────────── */

function Section({
  title,
  subtitle,
  loading,
  error,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  error: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-premium overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
              {subtitle}
            </p>
          )}
        </div>
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
