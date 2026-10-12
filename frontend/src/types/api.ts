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

export interface Patient extends PatientSummary {
  middle_name: string | null;
  address: string | null;
  occupation: string | null;
  civil_status: CivilStatus | null;
  referred_by: string | null;
  notes: string | null;
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
}

export type UpdatePatientPayload = Partial<CreatePatientPayload>;

/* ─── Medical history ───────────────────────────────────────────── */

/** Yes/No answers: `null` means not asked yet, which is not the same as "No". */
export interface MedicalHistoryAnswers {
  in_good_health: boolean | null;
  rheumatic_fever: boolean | null;
  heart_condition: boolean | null;
  diabetes: boolean | null;
  kidney_disease: boolean | null;
  high_blood_pressure: boolean | null;
  anemia: boolean | null;
  hepatitis: boolean | null;
  asthma: boolean | null;
  epilepsy: boolean | null;
  has_allergies: boolean | null;
  allergic_to_penicillin: boolean | null;
  other_allergies: string | null;
  taking_medicine: boolean | null;
  under_physician_care: boolean | null;
  physician_care_reason: string | null;
  previous_extraction: string | null;
  pregnant: boolean | null;
  bleeder: boolean | null;
  on_menstruation: boolean | null;
}

/** `GET /api/patients/:id/medical-history`. `updated_at` is null until first saved. */
export interface MedicalHistory extends MedicalHistoryAnswers {
  updated_at: ISODateTimeString | null;
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
  is_active: boolean;
}

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
