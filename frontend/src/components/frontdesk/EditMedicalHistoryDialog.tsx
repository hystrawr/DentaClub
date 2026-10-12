"use client";

import { useState } from "react";
import { Field, FormDialog, TextField } from "@/components/ui/form";
import { useSaveMedicalHistory } from "@/lib/api/patients";
import { emptyAnswers, MEDICAL_HISTORY, showGroup } from "@/lib/utils/medical-history";
import type { MedicalHistory, MedicalHistoryAnswers, Patient } from "@/types/api";

/** Every question's saved answer, and nothing else (no `updated_at`). */
const answersFrom = (history: MedicalHistory): MedicalHistoryAnswers =>
  Object.fromEntries(
    Object.keys(emptyAnswers()).map((key) => [key, history[key as keyof MedicalHistoryAnswers]]),
  ) as unknown as MedicalHistoryAnswers;

/**
 * Fill in or correct a patient's medical history. Each question has Yes and No;
 * pressing the chosen answer again clears it back to "not asked".
 */
export function EditMedicalHistoryDialog({
  patient,
  history,
  open,
  onClose,
}: {
  patient: Patient;
  history: MedicalHistory;
  open: boolean;
  onClose: () => void;
}) {
  const save = useSaveMedicalHistory(patient.id);
  const [answers, setAnswers] = useState<MedicalHistoryAnswers>(() => answersFrom(history));

  // Reopening shows the history as saved, not the last unsaved edit.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAnswers(answersFrom(history));
      save.reset();
    }
  }

  const set = <K extends keyof MedicalHistoryAnswers>(key: K, value: MedicalHistoryAnswers[K]) =>
    setAnswers((a) => ({ ...a, [key]: value }));

  function submit() {
    if (save.isPending) return;
    save.mutate(answers, { onSuccess: onClose });
  }

  return (
    <FormDialog
      open={open}
      title={`Medical history — ${patient.full_name}`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Save medical history"
      submitting={save.isPending}
      error={save.error}
    >
      {MEDICAL_HISTORY.filter((group) => showGroup(group, patient.sex, answers)).map((group, i) => (
        <fieldset key={group.title ?? i} className="space-y-2">
          {group.title && (
            <legend className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle-foreground)" }}>
              {group.title}
            </legend>
          )}
          {group.questions.map((q) => (
            <div key={q.key} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm" style={{ color: "var(--color-foreground)" }}>
                  {q.label}
                </span>
                <YesNo label={q.label} value={answers[q.key]} onChange={(v) => set(q.key, v)} />
              </div>
              {q.detail && (
                <Field label={q.detail.label}>
                  <TextField
                    value={answers[q.detail.key] ?? ""}
                    onChange={(e) => set(q.detail!.key, e.target.value)}
                    maxLength={1000}
                  />
                </Field>
              )}
            </div>
          ))}
          {group.text?.map((t) => (
            <Field key={t.key} label={t.label}>
              <TextField value={answers[t.key] ?? ""} onChange={(e) => set(t.key, e.target.value)} maxLength={1000} />
            </Field>
          ))}
        </fieldset>
      ))}
    </FormDialog>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-border)" }}>
      {([true, false] as const).map((option) => {
        const selected = value === option;
        return (
          <button
            key={String(option)}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(selected ? null : option)}
            className="px-3 py-1 text-xs font-semibold transition-colors"
            style={{
              background: selected ? "var(--color-primary)" : "var(--color-surface)",
              color: selected ? "#fff" : "var(--color-muted-foreground)",
              borderLeft: option ? undefined : "1px solid var(--color-border)",
            }}
          >
            {option ? "Yes" : "No"}
          </button>
        );
      })}
    </div>
  );
}
