"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCreatePatient } from "@/lib/api/patients";
import { CIVIL_STATUSES, SEXES, type CivilStatus, type Sex } from "@/types/api";
import { Field, FormDialog, SelectField, TextField } from "@/components/ui/form";

const EMPTY = {
  first_name: "",
  last_name: "",
  middle_name: "",
  date_of_birth: "",
  sex: "",
  civil_status: "",
  mobile: "",
  email: "",
  address: "",
  occupation: "",
  referred_by: "",
};

/**
 * Create a patient (from DentalOS's NewPatientModal). On success it opens the
 * new chart — the next thing the front desk does is almost always book or
 * chart, and a modal that just closes leaves them hunting for the row.
 */
export function NewPatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreatePatient();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleClose() {
    setForm(EMPTY);
    create.reset();
    onClose();
  }

  function handleSubmit() {
    create.mutate(
      {
        first_name: form.first_name,
        last_name: form.last_name,
        middle_name: form.middle_name || null,
        date_of_birth: form.date_of_birth,
        // Typed to the API's enum, so the form cannot send a value the API refuses.
        sex: form.sex as Sex,
        civil_status: (form.civil_status || null) as CivilStatus | null,
        mobile: form.mobile || null,
        email: form.email || null,
        address: form.address || null,
        occupation: form.occupation || null,
        referred_by: form.referred_by || null,
      },
      {
        onSuccess: (patient) => {
          handleClose();
          router.push(`/patients/${patient.id}/overview` as Route);
        },
      },
    );
  }

  const incomplete = !form.first_name.trim() || !form.last_name.trim() || !form.date_of_birth || !form.sex;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <FormDialog
      open={open}
      title="New Patient"
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel="Create Patient"
      submitting={create.isPending}
      disabled={incomplete}
      error={create.error}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="First Name">
          <TextField required value={form.first_name} onChange={set("first_name")} maxLength={100} />
        </Field>
        <Field label="Last Name">
          <TextField required value={form.last_name} onChange={set("last_name")} maxLength={100} />
        </Field>
      </div>

      <Field label="Middle Name">
        <TextField value={form.middle_name} onChange={set("middle_name")} maxLength={100} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of Birth">
          <TextField type="date" required max={today} value={form.date_of_birth} onChange={set("date_of_birth")} />
        </Field>
        <Field label="Sex">
          <SelectField required value={form.sex} onChange={set("sex")}>
            <option value="">— Select —</option>
            {SEXES.map((value) => (
              <option key={value} value={value}>
                {value[0]!.toUpperCase() + value.slice(1)}
              </option>
            ))}
          </SelectField>
        </Field>
      </div>

      <Field label="Civil Status">
        <SelectField value={form.civil_status} onChange={set("civil_status")}>
          <option value="">— Select —</option>
          {CIVIL_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value[0]!.toUpperCase() + value.slice(1)}
            </option>
          ))}
        </SelectField>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile">
          <TextField type="tel" placeholder="+63 9XX XXX XXXX" value={form.mobile} onChange={set("mobile")} maxLength={20} />
        </Field>
        <Field label="Email">
          <TextField type="email" value={form.email} onChange={set("email")} maxLength={150} />
        </Field>
      </div>

      <Field label="Address">
        <TextField value={form.address} onChange={set("address")} maxLength={255} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Occupation">
          <TextField value={form.occupation} onChange={set("occupation")} maxLength={100} />
        </Field>
        <Field label="Referred By">
          <TextField value={form.referred_by} onChange={set("referred_by")} maxLength={150} />
        </Field>
      </div>
    </FormDialog>
  );
}
