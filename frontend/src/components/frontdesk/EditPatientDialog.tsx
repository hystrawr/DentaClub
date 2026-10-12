"use client";

import { useState } from "react";
import { Field, FormDialog, SelectField, TextAreaField, TextField } from "@/components/ui/form";
import { useUpdatePatient } from "@/lib/api/patients";
import { changedFields } from "@/lib/utils/patient-form";
import { CIVIL_STATUSES, SEXES, type Patient, type UpdatePatientPayload } from "@/types/api";

/**
 * Correct a patient's details (from DentalOS's EditPatientDialog).
 *
 * Only what changed is sent, so the button can say how many changes a save
 * will write, and an emptied optional field sends `null` — a real edit.
 */
const formFrom = (patient: Patient): Record<string, string> => ({
  first_name: patient.first_name ?? "",
  middle_name: patient.middle_name ?? "",
  last_name: patient.last_name ?? "",
  date_of_birth: patient.date_of_birth ?? "",
  sex: patient.sex ?? "",
  mobile: patient.mobile ?? "",
  email: patient.email ?? "",
  address: patient.address ?? "",
  occupation: patient.occupation ?? "",
  civil_status: patient.civil_status ?? "",
  referred_by: patient.referred_by ?? "",
  notes: patient.notes ?? "",
});

export function EditPatientDialog({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  const update = useUpdatePatient(patient.id);
  const [form, setForm] = useState<Record<string, string>>(() => formFrom(patient));

  // Reopening shows the patient as they are now, not the last unsaved edit.
  // (Resetting during render on the open transition, rather than in an effect.)
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(formFrom(patient));
      update.reset();
    }
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const payload = changedFields(formFrom(patient), form);
  const changedCount = Object.keys(payload).length;
  const nameMissing = !form.first_name!.trim() || !form.last_name!.trim();

  function submit() {
    if (changedCount === 0 || update.isPending) return;
    update.mutate(payload as UpdatePatientPayload, { onSuccess: onClose });
  }

  const grid = { gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" };

  return (
    <FormDialog
      open={open}
      title={`Edit ${patient.full_name}`}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={changedCount === 0 ? "No changes" : `Save ${changedCount} change${changedCount === 1 ? "" : "s"}`}
      submitting={update.isPending}
      disabled={changedCount === 0 || nameMissing}
      error={update.error}
    >
      <div className="grid gap-3" style={grid}>
        <Field label="First name">
          <TextField value={form.first_name} onChange={set("first_name")} maxLength={100} />
        </Field>
        <Field label="Middle name">
          <TextField value={form.middle_name} onChange={set("middle_name")} maxLength={100} />
        </Field>
        <Field label="Last name">
          <TextField value={form.last_name} onChange={set("last_name")} maxLength={100} />
        </Field>
      </div>

      <div className="grid gap-3" style={grid}>
        <Field label="Date of birth">
          <TextField type="date" value={form.date_of_birth} onChange={set("date_of_birth")} />
        </Field>
        <Field label="Sex">
          <SelectField value={form.sex} onChange={set("sex")}>
            {SEXES.map((value) => (
              <option key={value} value={value}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </SelectField>
        </Field>
        <Field label="Civil status">
          <SelectField value={form.civil_status} onChange={set("civil_status")}>
            <option value="">Not recorded</option>
            {CIVIL_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </SelectField>
        </Field>
      </div>

      <div className="grid gap-3" style={grid}>
        <Field label="Mobile">
          <TextField value={form.mobile} onChange={set("mobile")} maxLength={20} inputMode="tel" />
        </Field>
        <Field label="Email">
          <TextField value={form.email} onChange={set("email")} maxLength={150} inputMode="email" />
        </Field>
      </div>

      <Field label="Address">
        <TextField value={form.address} onChange={set("address")} maxLength={255} />
      </Field>

      <div className="grid gap-3" style={grid}>
        <Field label="Occupation">
          <TextField value={form.occupation} onChange={set("occupation")} maxLength={100} />
        </Field>
        <Field label="Referred by">
          <TextField value={form.referred_by} onChange={set("referred_by")} maxLength={150} />
        </Field>
      </div>

      <Field label="Notes" hint="Administrative notes. Clinical findings belong on the chart.">
        <TextAreaField value={form.notes} onChange={set("notes")} rows={3} />
      </Field>

      {nameMissing && (
        <p className="text-xs" style={{ color: "var(--color-destructive)" }}>
          A first and last name are required.
        </p>
      )}
    </FormDialog>
  );
}
