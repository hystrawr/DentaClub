/**
 * Wire types — what the backend sends, in DentalOS's snake_case shape.
 */

/** `YYYY-MM-DD` */
type ISODateString = string;
/** `2026-10-04T09:30:00+08:00` */
type ISODateTimeString = string;

export const SEXES = ["male", "female", "other"] as const;
export type Sex = (typeof SEXES)[number];

export const CIVIL_STATUSES = ["single", "married", "widowed", "separated"] as const;
export type CivilStatus = (typeof CIVIL_STATUSES)[number];

export interface PatientSummary {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  date_of_birth: ISODateString | null;
  age: number | null;
  is_minor: boolean;
  sex: Sex;
  mobile: string | null;
  email: string | null;
}

/** A visit or booking on the patient list: when, and with which dentist. */
export interface PatientVisit {
  appointment_id: string;
  start: ISODateTimeString;
  provider: { id: string; name: string };
}

/** A row of the patient list: the summary plus their last visit and next appointment. */
export interface PatientListItem extends PatientSummary {
  last_visit: PatientVisit | null;
  next_appointment: PatientVisit | null;
}

export interface Patient extends PatientSummary {
  middle_name: string | null;
  address: string | null;
  occupation: string | null;
  civil_status: CivilStatus | null;
  referred_by: string | null;
  notes: string | null;
  suffix: string | null;
  religion: string | null;
  nationality: string | null;
  home_office_phone: string | null;
  insurance_carrier: string | null;
  insurance_effective: string | null;
  chief_complaint: string | null;
  guardian_name: string | null;
  guardian_occupation: string | null;
  guardian_contact: string | null;
  created_at: ISODateTimeString | null;
  updated_at: ISODateTimeString | null;
}

export interface CreatePatientPayload {
  first_name: string;
  last_name: string;
  middle_name?: string | null;
  date_of_birth: ISODateString;
  sex: Sex;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
  civil_status?: CivilStatus | null;
  referred_by?: string | null;
  notes?: string | null;
  suffix?: string | null;
  religion?: string | null;
  nationality?: string | null;
  home_office_phone?: string | null;
  insurance_carrier?: string | null;
  insurance_effective?: string | null;
  chief_complaint?: string | null;
  guardian_name?: string | null;
  guardian_occupation?: string | null;
  guardian_contact?: string | null;
}

/** `POST /api/patients`: the patient, and their medical history when any of it was answered. */
export interface RegisterPatientPayload extends CreatePatientPayload {
  medical_history?: MedicalHistoryAnswers;
}

export type UpdatePatientPayload = Partial<CreatePatientPayload>;

/* ─── Medical history ───────────────────────────────────────────── */

export const DENTAL_ANXIETY = ["low", "moderate", "severe"] as const;
export type DentalAnxiety = (typeof DENTAL_ANXIETY)[number];

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

/**
 * Blocks B and C and Section 13 of the Patient Information Record.
 * Yes/No answers: `null` means not asked yet, which is not the same as "No".
 */
export interface MedicalHistoryAnswers {
  // Block B — dental history
  previous_dentist: string | null;
  /** `YYYY-MM` */
  last_dental_visit: string | null;
  dental_anxiety: DentalAnxiety | null;
  flossing_frequency: string | null;
  previous_extraction: string | null;

  // Block C — physician
  physician_name: string | null;
  physician_specialty: string | null;
  physician_address: string | null;
  physician_phone: string | null;

  // Block C — questions 1–7
  in_good_health: boolean | null;
  under_physician_care: boolean | null;
  physician_care_reason: string | null;
  serious_illness: boolean | null;
  serious_illness_detail: string | null;
  hospitalized: boolean | null;
  hospitalized_detail: string | null;
  taking_medicine: boolean | null;
  medication_detail: string | null;
  uses_tobacco: boolean | null;
  uses_drugs: boolean | null;
  drugs_detail: string | null;

  // Block C — item 8, allergies
  has_allergies: boolean | null;
  allergic_to_local_anesthetic: boolean | null;
  allergic_to_penicillin: boolean | null;
  allergic_to_sulfa: boolean | null;
  allergic_to_aspirin: boolean | null;
  allergic_to_latex: boolean | null;
  other_allergies: string | null;

  // Block C — items 9–12
  /** Item 9, bleeding time: true = prolonged. */
  bleeder: boolean | null;
  pregnant: boolean | null;
  nursing: boolean | null;
  birth_control_pills: boolean | null;
  on_menstruation: boolean | null;
  blood_type: BloodType | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;

  // Section 13
  /** Codes of the ticked conditions (see `CONDITIONS` in lib/utils/medical-history). */
  conditions: string[];
  other_conditions: string | null;
}

/** `GET /api/patients/:id/medical-history`. `updated_at` is null until first saved. */
export interface MedicalHistory extends MedicalHistoryAnswers {
  updated_at: ISODateTimeString | null;
}

/* ─── Treatment record ──────────────────────────────────────────── */

/** One row of the Treatment Record sheet. Balance is worked out on screen, not stored. */
export interface TreatmentRow {
  visit_date: ISODateString | null;
  teeth: string | null;
  procedure: string | null;
  doctor: string | null;
  /** Pesos. */
  amount_charged: number | null;
  amount_paid: number | null;
  next_appointment: ISODateString | null;
}

/** `GET /api/patients/:id/treatment-records`, top to bottom. */
export interface TreatmentRecord extends TreatmentRow {
  id: string;
}

/* ─── Consent ───────────────────────────────────────────────────── */

/** `GET /api/consent-form` — the clinic's one consent form. */
export interface ConsentForm {
  text: string;
  /** Sent back when signing, so a form edited mid-read is refused. */
  version: string;
  /** True while backend/consent-form.txt still holds the starter text. */
  is_placeholder: boolean;
}

/** `GET /api/patients/:id/consent`. */
export interface PatientConsent {
  /** The latest signing, or null if the patient has never signed. */
  current: {
    id: string;
    form_text: string;
    signer_name: string;
    /** Set when a parent or guardian signed for the patient. */
    signer_relationship: string | null;
    signature_image: string;
    document_id: string;
    signed_at: ISODateTimeString;
  } | null;
  /** Earlier signed PDFs, newest first. */
  previous: Array<{ document_id: string; title: string; size_bytes: number | null; signed_at: ISODateTimeString }>;
}

export interface SignConsentPayload {
  form_version: string;
  signature_data_uri: string;
  signer_name?: string;
  signer_relationship?: string;
}

/* ─── Scheduling ─────────────────────────────────────────────────── */

export type AppointmentStatus = "scheduled" | "confirmed" | "arrived" | "in_chair" | "completed" | "cancelled" | "no_show";

export interface Appointment {
  id: string;
  status: AppointmentStatus;
  /** Manila time with an explicit offset: `2026-10-05T09:00:00+08:00`. */
  scheduled_start: ISODateTimeString;
  scheduled_end: ISODateTimeString;
  actual_start: ISODateTimeString | null;
  actual_end: ISODateTimeString | null;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: ISODateTimeString;
  patient: { id: string; full_name: string } | null;
  provider: { id: string; name: string; color_hex: string } | null;
  appointment_type: { id: string; name: string; duration_minutes: number; color_hex: string } | null;
  operatory: { id: string; name: string; color: string | null } | null;
}

export interface CreateAppointmentPayload {
  provider_profile_id: string;
  scheduled_start: ISODateTimeString;
  scheduled_end: ISODateTimeString;
  patient_id?: string | null;
  appointment_type_id?: string | null;
  operatory_id?: string | null;
  notes?: string | null;
}

/** One row of the chairside board. */
export interface BoardItem {
  id: string;
  patient_name: string | null;
  appointment_type_name: string | null;
  status: AppointmentStatus;
  scheduled_start: ISODateTimeString;
}

/** `GET /api/chairside/board` — today's appointments keyed by chair name. */
export type ChairsideBoard = Record<string, BoardItem[]>;

export interface Provider {
  id: string;
  name: string;
  prc_number: string | null;
  specializations: string[] | null;
  color_hex: string;
  is_active: boolean;
}

export interface AppointmentType {
  id: string;
  name: string;
  duration_minutes: number;
  color_hex: string;
  is_block_time: boolean;
  recall_interval_months: number | null;
  /** Pesos; null when the service has no set price. */
  price: number | null;
  is_active: boolean;
}

/** `POST /api/appointment-types` and `PATCH /api/appointment-types/:id`. */
export type AppointmentTypePayload = Partial<Omit<AppointmentType, "id">>;

export interface Operatory {
  id: string;
  location_id: string;
  location_name: string | null;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Slot {
  start: string; // "HH:mm"
  end: string;
}
