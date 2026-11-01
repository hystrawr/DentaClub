"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Users, X } from "lucide-react";
import { FormError } from "@/components/ui/form";
import { checkPatientName, useCreatePatient, useDeletePatient, useSaveMedicalHistory, useUpdatePatient } from "@/lib/api/patients";
import { emptyAnswers, FLOSSING, SCREENING, showWomenOnly, toSave, WOMEN_ONLY } from "@/lib/utils/medical-history";
import { manilaToday } from "@/lib/utils/manila";
import {
  BLOOD_TYPES,
  CIVIL_STATUSES,
  SEXES,
  type CivilStatus,
  type MedicalHistory,
  type MedicalHistoryAnswers,
  type Patient,
  type Sex,
} from "@/types/api";
import { AllergyCards } from "./AllergyCards";
import { ConditionsChecklist } from "./ConditionsChecklist";
import { ResetDelete, SaveBar } from "./RecordPanel";
import { ChoiceToggle, YesNoToggle } from "./YesNoToggle";

/** Block A, as typed: every field a string, "" when empty. */
const DETAIL_KEYS = [
  "last_name",
  "first_name",
  "middle_name",
  "suffix",
  "date_of_birth",
  "sex",
  "civil_status",
  "religion",
  "nationality",
  "address",
  "mobile",
  "home_office_phone",
  "email",
  "occupation",
  "insurance_carrier",
  "insurance_effective",
  "referred_by",
  "chief_complaint",
  "guardian_name",
  "guardian_occupation",
  "guardian_contact",
] as const;

type DetailKey = (typeof DETAIL_KEYS)[number];
type Details = Record<DetailKey, string>;

const detailsFrom = (p: Patient | null): Details =>
  Object.fromEntries(DETAIL_KEYS.map((k) => [k, (p?.[k] as string | null | undefined) ?? ""])) as Details;

/** Only the answers, without `updated_at`, so they compare and save as they are. */
function answersFrom(history: MedicalHistory): MedicalHistoryAnswers {
  const answers: Partial<MedicalHistory> = { ...history };
  delete answers.updated_at;
  return answers as MedicalHistoryAnswers;
}

const SUFFIXES = ["Jr.", "Sr.", "II", "III", "IV"];
const REQUIRED: DetailKey[] = ["last_name", "first_name", "date_of_birth", "sex"];
const NAME_KEYS: DetailKey[] = ["first_name", "middle_name", "last_name"];

/** New-patient registration, one block of the paper form per step. */
const STEPS = ["Patient Information", "Dental History", "Medical History & Physician", "Conditions"] as const;
const LAST_STEP = STEPS.length - 1;
const SEX_LABEL: Record<Sex, string> = { male: "Male", female: "Female", other: "Other" };
const CIVIL_LABEL: Record<CivilStatus, string> = { single: "Single", married: "Married", widowed: "Widowed", separated: "Separated" };
const ANXIETY = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
] as const;

function ageOn(dob: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const today = manilaToday();
  const years = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  return today.slice(5) < dob.slice(5) ? years - 1 : years;
}

/**
 * The Patient Information Record: Block A (the patient), Block B (dental
 * history), Block C (medical history and physician) and Section 13
 * (conditions), laid out as on the clinic's paper form and edited in place.
 *
 * "Unsaved changes" is measured against what the server last sent back.
 *
 * With `patient` null it registers a new patient instead: the same form, empty,
 * one block per step with Back and Next, saved in one request with Create
 * Patient on the last step, and closed with `onCancel`. Step 1 must be filled
 * in, and its name not already on file, before Next; the rest is optional.
 */
export function PatientInfoForm(
  props:
    | { patient: Patient; history: MedicalHistory; onCancel?: never }
    | { patient: null; history?: never; onCancel: () => void },
) {
  const { patient, onCancel } = props;
  const creating = patient === null;
  const router = useRouter();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient(patient?.id ?? "");
  const saveHistory = useSaveMedicalHistory(patient?.id ?? "");
  const deletePatient = useDeletePatient(patient?.id ?? "");

  const [saved, setSaved] = useState(() => ({
    details: detailsFrom(patient),
    answers: props.history ? answersFrom(props.history) : emptyAnswers(),
  }));
  const [details, setDetails] = useState(saved.details);
  const [answers, setAnswers] = useState(saved.answers);
  // Bumped by Reset, to remount the pieces that keep their own open/closed state.
  const [resets, setResets] = useState(0);
  const [missing, setMissing] = useState<DetailKey[]>([]);
  // Registration only: the step shown, and the duplicate-name check on leaving step 1.
  const [step, setStep] = useState(0);
  const [checkingName, setCheckingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const age = ageOn(details.date_of_birth);
  const [guardianOpen, setGuardianOpen] = useState(
    () => (age !== null && age < 18) || Boolean(patient?.guardian_name || patient?.guardian_occupation || patient?.guardian_contact),
  );
  const showGuardian = guardianOpen || (age !== null && age < 18);

  const detailsDirty = DETAIL_KEYS.some((k) => details[k] !== saved.details[k]);
  const answersDirty = JSON.stringify(answers) !== JSON.stringify(saved.answers);
  const saving = createPatient.isPending || updatePatient.isPending || saveHistory.isPending;

  const set = (key: DetailKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDetails((d) => ({ ...d, [key]: e.target.value }));
    setMissing((m) => m.filter((k) => k !== key));
    if (NAME_KEYS.includes(key)) setNameError(null);
  };
  const answer = (patch: Partial<MedicalHistoryAnswers>) => setAnswers((a) => ({ ...a, ...patch }));
  const text = (key: keyof MedicalHistoryAnswers) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    answer({ [key]: e.target.value || null });

  /** Flags the required fields left empty; true when there are none. */
  function requiredFilled(): boolean {
    const empty = REQUIRED.filter((k) => !details[k].trim());
    setMissing(empty);
    return empty.length === 0;
  }

  /** Step 1 is done when its required fields are in and the name is not already on file. */
  async function patientStepValid(): Promise<boolean> {
    if (!requiredFilled()) return false;
    setCheckingName(true);
    try {
      const found = await checkPatientName(details);
      if (found.exists) {
        setNameError(`A patient named ${found.full_name} already exists.`);
        return false;
      }
      return true;
    } catch {
      // The server checks again on Create, so a failed lookup does not block registering.
      return true;
    } finally {
      setCheckingName(false);
    }
  }

  async function goTo(next: number) {
    if (next === step) return;
    if (step === 0 && next > 0 && !(await patientStepValid())) return;
    setStep(next);
    headerRef.current?.parentElement?.scrollTo({ top: 0 });
  }

  /** The bottom button, and Enter in a field: Next until the last step, then Create Patient. */
  function primary() {
    if (creating && step < LAST_STEP) void goTo(step + 1);
    else void save();
  }

  async function save() {
    if (!requiredFilled()) {
      if (creating) setStep(0);
      return;
    }

    const patientFields = {
      ...Object.fromEntries(DETAIL_KEYS.map((k) => [k, details[k].trim() || null])),
      first_name: details.first_name.trim(),
      last_name: details.last_name.trim(),
      date_of_birth: details.date_of_birth,
      sex: details.sex as Sex,
      civil_status: (details.civil_status || null) as CivilStatus | null,
    };

    try {
      if (creating) {
        // History only when something in it was answered: an untouched checklist
        // would otherwise be stored as "No" to every condition.
        const created = await createPatient.mutateAsync({
          ...patientFields,
          ...(answersDirty ? { medical_history: toSave(answers) } : {}),
        });
        router.push(`/patients/${created.id}/info`);
        onCancel();
        return;
      }
      if (detailsDirty) {
        const updated = await updatePatient.mutateAsync(patientFields);
        const fresh = detailsFrom(updated);
        setDetails(fresh);
        setSaved((s) => ({ ...s, details: fresh }));
      }
      if (answersDirty) {
        const fresh = answersFrom(await saveHistory.mutateAsync(toSave(answers)));
        setAnswers(fresh);
        setSaved((s) => ({ ...s, answers: fresh }));
      }
    } catch {
      // Shown under the form from the mutation's own error.
    }
  }

  function reset() {
    setDetails(saved.details);
    setAnswers(saved.answers);
    setMissing([]);
    setResets((n) => n + 1);
    createPatient.reset();
    updatePatient.reset();
    saveHistory.reset();
  }

  const input = (key: DetailKey, props?: React.ComponentProps<"input">) => (
    <input
      className="record-input"
      value={details[key]}
      onChange={set(key)}
      aria-invalid={missing.includes(key) || undefined}
      {...props}
    />
  );

  const women = showWomenOnly(details.sex, answers);
  /** Every block shows when editing; one at a time when registering. */
  const shows = (i: number) => !creating || step === i;

  function cancel() {
    if ((detailsDirty || answersDirty) && !window.confirm("Discard this new patient? Nothing has been saved.")) return;
    onCancel?.();
  }

  return (
    <>
      {creating && (
        <div
          ref={headerRef}
          className="sticky top-0 z-10 px-4 sm:px-6 pt-4 pb-3 space-y-3"
          style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
              New Patient
              <span className="ml-2 text-xs font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                Step {step + 1} of {STEPS.length}
              </span>
            </h2>
            <button type="button" onClick={cancel} className="btn-ghost p-1 rounded-md" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <StepBar step={step} onSelect={(i) => void goTo(i)} disabled={checkingName || saving} />
        </div>
      )}
      <form
        className="p-4 sm:p-6"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          primary();
        }}
      >
        {/* ── Block A ─────────────────────────────────────────────── */}
        {shows(0) && (
          <Block title="Patient Information" tag="Required for registration">
            <div className="grid grid-cols-12 gap-x-4 gap-y-3.5">
              <F label="Last Name" required className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("last_name", { maxLength: 100 })}
              </F>
              <F label="First Name" required className="col-span-12 sm:col-span-6 lg:col-span-4">
                {input("first_name", { maxLength: 100 })}
              </F>
              <F label="Middle Name" className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("middle_name", { maxLength: 100 })}
              </F>
              <F label="Suffix" className="col-span-12 sm:col-span-6 lg:col-span-2">
                <select className="record-input" value={details.suffix} onChange={set("suffix")}>
                  <option value="">None</option>
                  {SUFFIXES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </F>

              <F label="Birthdate" required className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("date_of_birth", { type: "date", max: manilaToday() })}
              </F>
              <F label="Age" className="col-span-6 lg:col-span-1">
                <input className="record-input" value={age ?? ""} readOnly tabIndex={-1} />
              </F>
              <F label="Sex" required className="col-span-6 lg:col-span-2">
                <select className="record-input" value={details.sex} onChange={set("sex")} aria-invalid={missing.includes("sex") || undefined}>
                  <option value="">Select</option>
                  {SEXES.map((s) => (
                    <option key={s} value={s}>
                      {SEX_LABEL[s]}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Civil Status" className="col-span-12 sm:col-span-6 lg:col-span-2">
                <select className="record-input" value={details.civil_status} onChange={set("civil_status")}>
                  <option value="">Select</option>
                  {CIVIL_STATUSES.map((c) => (
                    <option key={c} value={c}>
                      {CIVIL_LABEL[c]}
                    </option>
                  ))}
                </select>
              </F>
              <F label="Religion" className="col-span-12 sm:col-span-6 lg:col-span-2">
                {input("religion", { maxLength: 100 })}
              </F>
              <F label="Nationality" className="col-span-12 sm:col-span-6 lg:col-span-2">
                {input("nationality", { maxLength: 100 })}
              </F>

              <F label="Home Address" className="col-span-12 lg:col-span-6">
                {input("address", { maxLength: 255 })}
              </F>
              <F label="Cell / Mobile No." className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("mobile", { maxLength: 20, inputMode: "tel" })}
              </F>
              <F label="Home No. / Office No." className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("home_office_phone", { maxLength: 30, inputMode: "tel" })}
              </F>

              <F label="Email Address" className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("email", { type: "email", maxLength: 150 })}
              </F>
              <F label="Occupation" className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("occupation", { maxLength: 100 })}
              </F>
              <F label="Dental Insurance" className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("insurance_carrier", { maxLength: 150 })}
              </F>
              <F label="Effective Date / Group #" className="col-span-12 sm:col-span-6 lg:col-span-3">
                {input("insurance_effective", { maxLength: 150 })}
              </F>

              <F label="Referred By" className="col-span-12 lg:col-span-4">
                {input("referred_by", { maxLength: 150 })}
              </F>
              <F label="Reason for dental consultation (chief complaint)" className="col-span-12 lg:col-span-8">
                {input("chief_complaint", { maxLength: 1000 })}
              </F>
            </div>

            <div
              className="flex items-center gap-2.5 flex-wrap mt-5 text-[13px] font-medium"
              style={{ color: "var(--color-foreground)" }}
            >
              <Users size={16} aria-hidden="true" style={{ color: "var(--color-muted-foreground)" }} />
              For minors only: Parent / Guardian
              <span className="chip font-medium" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", color: "var(--color-muted-foreground)" }}>
                {age === null ? "Enter a birthdate first" : age < 18 ? `Required (patient is ${age})` : `Not applicable (patient is ${age})`}
              </span>
              {(age === null || age >= 18) && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm ml-auto"
                  aria-expanded={showGuardian}
                  onClick={() => setGuardianOpen((o) => !o)}
                >
                  {showGuardian ? "Hide fields" : "Show fields"}
                </button>
              )}
            </div>
            {showGuardian && (
              <div className="grid grid-cols-12 gap-x-4 gap-y-3.5 mt-3">
                <F label="Parent / Guardian's Name" className="col-span-12 lg:col-span-4">
                  {input("guardian_name", { maxLength: 150 })}
                </F>
                <F label="Occupation" className="col-span-12 sm:col-span-6 lg:col-span-4">
                  {input("guardian_occupation", { maxLength: 100 })}
                </F>
                <F label="Contact No." className="col-span-12 sm:col-span-6 lg:col-span-4">
                  {input("guardian_contact", { maxLength: 30, inputMode: "tel" })}
                </F>
              </div>
            )}
          </Block>
        )}

        {/* ── Block B ─────────────────────────────────────────────── */}
        {shows(1) && (
          <Block title="Dental History">
            <div className="grid grid-cols-12 gap-x-4 gap-y-3.5">
              <F label="Previous Dentist" className="col-span-12 sm:col-span-6 lg:col-span-3">
                <input className="record-input" value={answers.previous_dentist ?? ""} onChange={text("previous_dentist")} maxLength={1000} />
              </F>
              <F label="Last Dental Visit" className="col-span-12 sm:col-span-6 lg:col-span-3">
                <input
                  className="record-input"
                  type="month"
                  value={answers.last_dental_visit ?? ""}
                  onChange={text("last_dental_visit")}
                  max={manilaToday().slice(0, 7)}
                />
              </F>
              <div className="col-span-12 sm:col-span-6 lg:col-span-3 flex flex-col gap-1.5">
                <span className="record-label">
                  Dental anxiety (self-reported)
                </span>
                <ChoiceToggle
                  label="Dental anxiety"
                  options={ANXIETY}
                  value={answers.dental_anxiety}
                  onChange={(v) => answer({ dental_anxiety: v })}
                  severe="severe"
                />
              </div>
              <F label="Flossing Frequency" className="col-span-12 sm:col-span-6 lg:col-span-3">
                <select className="record-input" value={answers.flossing_frequency ?? ""} onChange={text("flossing_frequency")}>
                  <option value="">Select</option>
                  {FLOSSING.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </F>
              <F label="Previous Extraction" className="col-span-12">
                <input
                  className="record-input"
                  value={answers.previous_extraction ?? ""}
                  onChange={text("previous_extraction")}
                  placeholder="Which tooth, when, and any complications"
                  maxLength={1000}
                />
              </F>
            </div>
          </Block>
        )}

        {/* ── Block C ─────────────────────────────────────────────── */}
        {shows(2) && (
          <Block title="Medical History & Physician" tag="Items 1 to 12">
            <div className="grid grid-cols-12 gap-x-4 gap-y-3.5">
              <F label="Name of Physician" className="col-span-12 sm:col-span-6 lg:col-span-3">
                <input className="record-input" value={answers.physician_name ?? ""} onChange={text("physician_name")} maxLength={1000} />
              </F>
              <F label="Specialty" className="col-span-12 sm:col-span-6 lg:col-span-3">
                <input className="record-input" value={answers.physician_specialty ?? ""} onChange={text("physician_specialty")} maxLength={1000} />
              </F>
              <F label="Office Address" className="col-span-12 sm:col-span-6 lg:col-span-3">
                <input className="record-input" value={answers.physician_address ?? ""} onChange={text("physician_address")} maxLength={1000} />
              </F>
              <F label="Office Number" className="col-span-12 sm:col-span-6 lg:col-span-3">
                <input className="record-input" value={answers.physician_phone ?? ""} onChange={text("physician_phone")} maxLength={30} inputMode="tel" />
              </F>
            </div>

            <p className="text-[11px] font-semibold uppercase tracking-wider mt-6 mb-1" style={{ color: "var(--color-subtle-foreground)" }}>
              Screening (questions 1 – 7)
            </p>
            <div className="flex flex-col">
              {SCREENING.map((q) => {
                const open = answers[q.key] === true && q.detail;
                return (
                  <div
                    key={q.key}
                    className="grid gap-x-4 gap-y-2 items-center px-3 py-2.5 rounded-lg"
                    style={{
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      background: open ? "var(--color-surface-raised)" : undefined,
                      borderBottom: open ? undefined : "1px solid var(--color-border)",
                    }}
                  >
                    <span className="text-sm" style={{ color: "var(--color-foreground)" }}>
                      {q.label}
                    </span>
                    <YesNoToggle label={q.label} value={answers[q.key] as boolean | null} onChange={(v) => answer({ [q.key]: v })} />
                    {open && q.detail && (
                      <label className="col-span-2 flex items-center gap-2.5">
                        <span className="text-xs whitespace-nowrap" style={{ color: "var(--color-muted-foreground)" }}>
                          {q.detail.label}:
                        </span>
                        <input
                          className="record-input"
                          style={{ height: 34 }}
                          value={(answers[q.detail.key] as string | null) ?? ""}
                          onChange={text(q.detail.key)}
                          maxLength={1000}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <AllergyCards key={resets} answers={answers} onChange={answer} />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3.5 mt-6">
              <Vital label="9. Bleeding Time">
                <select
                  className="record-input"
                  style={{ height: 34 }}
                  value={answers.bleeder === null ? "" : answers.bleeder ? "prolonged" : "normal"}
                  onChange={(e) => answer({ bleeder: e.target.value === "" ? null : e.target.value === "prolonged" })}
                  aria-label="Bleeding time"
                >
                  <option value="">Select</option>
                  <option value="normal">Normal</option>
                  <option value="prolonged">Prolonged</option>
                </select>
              </Vital>

              <Vital label="10. For Women Only" muted={!women}>
                {women ? (
                  WOMEN_ONLY.map((q) => (
                    <div key={q.key} className="flex items-center justify-between gap-2 text-xs">
                      {q.label}
                      <YesNoToggle label={q.label} value={answers[q.key] as boolean | null} onChange={(v) => answer({ [q.key]: v })} />
                    </div>
                  ))
                ) : (
                  <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {details.sex === "male" ? "Not applicable (male patient)" : details.sex ? "Not applicable" : "Applies to female patients"}
                  </span>
                )}
              </Vital>

              <Vital label="11. Blood Type">
                <select
                  className="record-input"
                  style={{ height: 34 }}
                  value={answers.blood_type ?? ""}
                  onChange={(e) => answer({ blood_type: (e.target.value || null) as MedicalHistoryAnswers["blood_type"] })}
                  aria-label="Blood type"
                >
                  <option value="">Select</option>
                  {BLOOD_TYPES.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </Vital>

              <Vital label="12. Blood Pressure">
                <div className="flex items-center gap-1.5">
                  {(["bp_systolic", "bp_diastolic"] as const).map((key, i) => (
                    <span key={key} className="contents">
                      {i === 1 && "/"}
                      <input
                        className="record-input text-center font-mono"
                        style={{ height: 34, width: 64 }}
                        inputMode="numeric"
                        value={answers[key] ?? ""}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                          answer({ [key]: digits ? Number(digits) : null });
                        }}
                        aria-label={key === "bp_systolic" ? "Systolic" : "Diastolic"}
                      />
                    </span>
                  ))}
                  <small style={{ color: "var(--color-muted-foreground)" }}>mmHg</small>
                </div>
              </Vital>
            </div>
          </Block>
        )}

        {/* ── Section 13 ──────────────────────────────────────────── */}
        {shows(3) && (
          <Block title="Do you have or have you had any of the following?" tag="Check all that apply">
            <ConditionsChecklist value={answers.conditions} onChange={(conditions) => answer({ conditions })} />
            <F label="Other conditions" className="mt-3 max-w-[420px]">
              <input
                className="record-input"
                value={answers.other_conditions ?? ""}
                onChange={text("other_conditions")}
                placeholder="None reported"
                maxLength={1000}
              />
            </F>
          </Block>
        )}

        {/* Enter in a field saves (or moves to the next step), as in any form. */}
        <button type="submit" hidden />
      </form>

      <SaveBar
        dirty={detailsDirty || answersDirty}
        saving={saving}
        saveLabel={creating ? (step < LAST_STEP ? (checkingName ? "Checking…" : "Next") : "Create Patient") : undefined}
        disabled={checkingName}
        tools={
          creating ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={cancel} disabled={saving}>
                Cancel
              </button>
              {step > 0 && (
                <button type="button" className="btn btn-secondary" onClick={() => void goTo(step - 1)} disabled={saving}>
                  <ChevronLeft size={15} aria-hidden="true" /> Back
                </button>
              )}
            </>
          ) : (
            <ResetDelete
              onReset={reset}
              resetDisabled={!detailsDirty && !answersDirty}
              onDelete={() => deletePatient.mutate(undefined, { onSuccess: () => router.replace("/patients") })}
              confirmText="Delete this patient and every record?"
              deleting={deletePatient.isPending}
            />
          )
        }
        onSave={primary}
        error={
          missing.length > 0 ? (
            <span role="alert" style={{ color: "var(--color-destructive)" }}>
              Fill in the last name, first name, birthdate and sex.
            </span>
          ) : nameError ? (
            <span role="alert" style={{ color: "var(--color-destructive)" }}>
              {nameError}
            </span>
          ) : (
            <FormError error={createPatient.error ?? updatePatient.error ?? saveHistory.error ?? deletePatient.error} />
          )
        }
      />
    </>
  );
}

/* ─── Pieces ────────────────────────────────────────────────────── */

/** Registration's steps: done ones ticked and clickable, the current one highlighted. */
function StepBar({ step, onSelect, disabled }: { step: number; onSelect: (i: number) => void; disabled?: boolean }) {
  return (
    <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto" aria-label="Registration steps">
      {STEPS.map((label, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={label} className="flex items-center gap-1 sm:gap-2 shrink-0">
            {i > 0 && <ChevronRight size={14} aria-hidden="true" style={{ color: "var(--color-subtle-foreground)" }} />}
            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={disabled || current}
              aria-current={current ? "step" : undefined}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold disabled:cursor-default"
              style={{
                background: current ? "var(--color-primary)" : "transparent",
                color: current ? "var(--color-primary-foreground)" : done ? "var(--color-primary)" : "var(--color-muted-foreground)",
                border: `1px solid ${current || done ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
            >
              <span
                className="flex items-center justify-center rounded-full text-[10px]"
                style={{
                  width: 18,
                  height: 18,
                  background: current ? "rgba(255,255,255,0.25)" : done ? "var(--color-primary)" : "var(--color-surface-subtle)",
                  color: done ? "var(--color-primary-foreground)" : undefined,
                }}
              >
                {done ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** A block of the paper form, under its title. */
function Block({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <section className="record-block">
      <div className="record-block-head">
        <h3 className="text-[15px] font-semibold" style={{ color: "var(--color-foreground)" }}>
          {title}
        </h3>
        {tag && (
          <span className="text-[11px] font-medium rounded-full px-2.5 py-0.5" style={{ color: "var(--color-muted-foreground)", background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}>
            {tag}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function F({ label, required, className, children }: { label: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <label className={`flex flex-col gap-1.5 min-w-0 ${className ?? ""}`}>
      <span className="record-label">
        {label}
        {required && (
          <em className="not-italic ml-0.5" style={{ color: "var(--color-destructive)" }} aria-hidden="true">
            *
          </em>
        )}
      </span>
      {children}
    </label>
  );
}

function Vital({ label, muted, children }: { label: string; muted?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-2 min-w-0"
      style={{ opacity: muted ? 0.6 : 1 }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--color-muted-foreground)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}
