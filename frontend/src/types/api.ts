/**
 * Wire types — what the backend sends, in DentalOS's snake_case shape.
 */

/** `YYYY-MM-DD` */
type ISODateString = string;
/** `2026-10-04T09:30:00+08:00` */
type ISODateTimeString = string;

export const SEXES = ["male", "female", "other"] as const;
export type Sex = (typeof SEXES)[number];

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
  notes?: string | null;
}

export type UpdatePatientPayload = Partial<CreatePatientPayload>;

/* ─── Consent & intake (shapes from DentalOS types/api.ts) ───────── */

type IntakeFieldType =
  | "text" | "textarea" | "number" | "tel" | "email" | "date"
  | "radio" | "select" | "checkbox" | "checkboxes" | "boolean"
  | "signature" | "consent_html";

export interface IntakeFieldSchema {
  key: string;
  type: IntakeFieldType;
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  html?: string;
}

/**
 * One wizard section. `show_if` is the HMO conditional; the server has already
 * folded it into `required`, so a hidden section can never block submission.
 */
export interface IntakeSection {
  key: string;
  title: string;
  template_id: string;
  required: boolean;
  show_if: { payor_type: string } | null;
  fields: IntakeFieldSchema[];
}

interface IntakeTemplate {
  id: string;
  name: string;
  version: number;
  parent_template_id: string | null;
  fields_schema: IntakeFieldSchema[];
  is_active: boolean;
}

export interface IntakePacket {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  items: Array<{
    id: string;
    sort_order: number;
    is_required: boolean;
    template: IntakeTemplate;
  }>;
}

/** `GET /api/public/intake/:token`, unwrapped from `{ data }`. */
export interface IntakePortalPacket {
  packet: IntakePacket;
  sections?: IntakeSection[];
  payor_type?: string | null;
  patient_name?: string;
  /** What the clinic already holds, keyed by field key — used to pre-fill. */
  patient_data: Record<string, unknown>;
  submission_id: string;
}

export interface IntakeSubmitPayload {
  responses: Record<string, unknown>;
  /** base64 PNG data URI */
  signature?: string;
}

export interface IntakeSubmission {
  id: string;
  patient_id: string;
  packet_id: string;
  appointment_id: string | null;
  status: "pending" | "completed";
  responses: Record<string, unknown> | null;
  completed_at: ISODateTimeString | null;
  document_id: string | null;
  created_at: ISODateTimeString;
}

export interface IntakeLink {
  token: string;
  expires_at: ISODateTimeString;
  submission_id: string;
  url: string;
}

export interface PatientDocument {
  id: string;
  patient_id: string;
  type: string;
  title: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  immutable: boolean;
  created_at: ISODateTimeString;
}

export const GUARDIAN_RELATIONSHIPS = ["parent", "legal_guardian", "grandparent", "sibling", "other"] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export interface GuardianLink {
  id: string;
  guardian_patient_id: string;
  ward_patient_id: string;
  relationship: GuardianRelationship;
  consent_authority_flag: boolean;
  guardian?: { id: string; first_name: string; last_name: string; date_of_birth: ISODateString | null };
  ward?: { id: string; first_name: string; last_name: string; date_of_birth: ISODateString | null };
  created_at: ISODateTimeString;
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

/** What confirming returns beside the appointment: the consent link it minted. */
export interface ConfirmIntake {
  generated: boolean;
  expires_at: ISODateTimeString | null;
  url: string | null;
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
