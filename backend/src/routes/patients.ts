import { Router } from "express";
import { z } from "zod";
import type { Patient } from "../generated/prisma/client.js";
import { requireAdmin } from "../lib/auth.js";
import { ageFrom, dateString, isoOffset } from "../lib/dates.js";
import { saveHistory } from "../services/medical-history.js";
import * as patients from "../services/patients.js";
import { fullName } from "../services/patients.js";

// Patients. Requests and responses use snake_case inside a `{ data }` envelope;
// the rules live in services/patients.ts. Mounted at /api/patients.
export const patientsRouter = Router();

const SEX = ["male", "female", "other"] as const;
const CIVIL_STATUS = ["single", "married", "widowed", "separated"] as const;

/**
 * The Patient Information Record's own fields (Block A): wire name → column and
 * length limit. All optional text, read and written the same way.
 */
const RECORD_TEXT = {
  suffix: ["suffix", 10],
  religion: ["religion", 100],
  nationality: ["nationality", 100],
  home_office_phone: ["homeOfficePhone", 30],
  insurance_carrier: ["insuranceCarrier", 150],
  insurance_effective: ["insuranceEffective", 150],
  chief_complaint: ["chiefComplaint", 1000],
  guardian_name: ["guardianName", 150],
  guardian_occupation: ["guardianOccupation", 100],
  guardian_contact: ["guardianContact", 30],
} as const satisfies Record<string, readonly [keyof Patient, number]>;

type RecordWire = { [K in keyof typeof RECORD_TEXT]?: string | null };

const recordText = (p: Patient) =>
  Object.fromEntries(Object.entries(RECORD_TEXT).map(([wire, [column]]) => [wire, p[column]])) as Required<RecordWire>;

/** Only the keys that were sent: absent = untouched, null = cleared. */
const recordData = (dto: RecordWire) =>
  Object.fromEntries(
    Object.entries(RECORD_TEXT).flatMap(([wire, [column]]) => {
      const value = dto[wire as keyof RecordWire];
      return value === undefined ? [] : [[column, value]];
    }),
  );

/** A patient as the directory and search results show them. */
function patientSummary(p: Patient) {
  const age = ageFrom(p.dateOfBirth);
  return {
    id: p.id,
    full_name: fullName(p),
    first_name: p.firstName,
    last_name: p.lastName,
    date_of_birth: dateString(p.dateOfBirth),
    age,
    is_minor: (age ?? 0) < 18,
    sex: p.sex,
    mobile: p.mobile,
    email: p.email,
  };
}

/** The full record, for the patient page. */
function patientDetail(p: Patient) {
  return {
    ...patientSummary(p),
    is_active: p.isActive,
    middle_name: p.middleName,
    address: p.address,
    occupation: p.occupation,
    civil_status: p.civilStatus,
    referred_by: p.referredBy,
    notes: p.notes,
    ...recordText(p),
    created_at: isoOffset(p.createdAt),
    updated_at: isoOffset(p.updatedAt),
  };
}

/** A visit in the directory: when, and with which dentist. */
const visit = (a: { id: string; scheduledStart: Date; provider: { id: string; name: string } } | undefined) =>
  a ? { appointment_id: a.id, start: isoOffset(a.scheduledStart), provider: a.provider } : null;

/**
 * Optional text: a blank input becomes `null` (cleared) and an absent key is
 * left alone, so deleting a wrong phone number really removes it.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullish();

/** Runs of spaces in a name become one, so "Juan  Dela Cruz" is stored as "Juan Dela Cruz". */
const singleSpaced = (s: string) => s.replace(/\s+/g, " ");

const createPatient = z.object({
  first_name: z.string().trim().min(1, "The first name field is required.").max(100).transform(singleSpaced),
  last_name: z.string().trim().min(1, "The last name field is required.").max(100).transform(singleSpaced),
  middle_name: optionalText(100).transform((s) => (s ? singleSpaced(s) : s)),
  date_of_birth: z.iso.date("The date of birth field must be a valid date."),
  sex: z.enum(SEX, "The selected sex is invalid."),
  mobile: optionalText(20),
  email: z
    .union([z.literal("").transform(() => null), z.email("The email field must be a valid email address.").max(150)])
    .nullish(),
  address: optionalText(255),
  occupation: optionalText(100),
  civil_status: z.enum(CIVIL_STATUS, "The selected civil status is invalid.").nullish(),
  referred_by: optionalText(150),
  notes: optionalText(5000),
  ...(Object.fromEntries(Object.entries(RECORD_TEXT).map(([wire, [, max]]) => [wire, optionalText(max)])) as {
    [K in keyof typeof RECORD_TEXT]: ReturnType<typeof optionalText>;
  }),
});

/** Registration can include the medical history, saved with the patient. */
const registerPatient = createPatient.extend({ medical_history: saveHistory.optional() });

/** Every field optional: absent = untouched, null = cleared. */
const updatePatient = createPatient.partial();

type PatientInput = z.infer<typeof updatePatient>;

/** Wire names → columns, writing only the keys that were sent. */
function toData(dto: PatientInput) {
  return {
    ...(dto.first_name !== undefined ? { firstName: dto.first_name } : {}),
    ...(dto.last_name !== undefined ? { lastName: dto.last_name } : {}),
    ...(dto.middle_name !== undefined ? { middleName: dto.middle_name } : {}),
    ...(dto.date_of_birth !== undefined ? { dateOfBirth: new Date(dto.date_of_birth) } : {}),
    ...(dto.sex !== undefined ? { sex: dto.sex } : {}),
    ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
    ...(dto.email !== undefined ? { email: dto.email } : {}),
    ...(dto.address !== undefined ? { address: dto.address } : {}),
    ...(dto.occupation !== undefined ? { occupation: dto.occupation } : {}),
    ...(dto.civil_status !== undefined ? { civilStatus: dto.civil_status } : {}),
    ...(dto.referred_by !== undefined ? { referredBy: dto.referred_by } : {}),
    ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    ...recordData(dto),
  };
}

/**
 * GET /api/patients?search=dela
 * `?status=inactive` lists removed patients instead.
 */
patientsRouter.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rows = await patients.list(search, req.query.status === "inactive");
  res.json({
    data: rows.map((row) => ({
      ...patientSummary(row.patient),
      last_visit: visit(row.lastVisit),
      next_appointment: visit(row.nextAppointment),
    })),
  });
});

const nameCheck = createPatient.pick({ first_name: true, middle_name: true, last_name: true });

/**
 * GET /api/patients/name-check?first_name=…&middle_name=…&last_name=…
 * Whether a patient by that name is already on file, so registration can say
 * so on its first step. Creating still checks again.
 */
patientsRouter.get("/name-check", async (req, res) => {
  const dto = nameCheck.parse(req.query);
  const clash = await patients.findNameClash({ firstName: dto.first_name, middleName: dto.middle_name ?? null, lastName: dto.last_name });
  res.json({ data: clash ? { exists: true, id: clash.id, full_name: fullName(clash) } : { exists: false } });
});

/** GET /api/patients/:id: the patient record, or 404. */
patientsRouter.get("/:id", async (req, res) => {
  res.json({ data: patientDetail(await patients.findOrFail(req.params.id)) });
});

/** POST /api/patients: register a patient, with their medical history when any was answered. */
patientsRouter.post("/", async (req, res) => {
  const { medical_history, ...dto } = registerPatient.parse(req.body);
  const patient = await patients.register(
    {
      firstName: dto.first_name,
      lastName: dto.last_name,
      dateOfBirth: new Date(dto.date_of_birth),
      sex: dto.sex,
      middleName: dto.middle_name ?? null,
      mobile: dto.mobile ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      occupation: dto.occupation ?? null,
      civilStatus: dto.civil_status ?? null,
      referredBy: dto.referred_by ?? null,
      notes: dto.notes ?? null,
      ...recordData(dto),
    },
    medical_history,
  );
  res.status(201).json({ data: patientDetail(patient) });
});

/** PATCH /api/patients/:id — partial update. */
patientsRouter.patch("/:id", async (req, res) => {
  await patients.assertActivePatient(req.params.id);
  const dto = updatePatient.parse(req.body);
  res.json({ data: patientDetail(await patients.update(req.params.id, toData(dto))) });
});

/** DELETE /api/patients/:id — takes the patient out of the directory (see patients.remove). */
patientsRouter.delete("/:id", async (req, res) => {
  await patients.remove(req.params.id);
  res.status(204).end();
});

/** POST /api/patients/:id/restore — puts a removed patient back in the directory. Admins only. */
patientsRouter.post("/:id/restore", requireAdmin, async (req, res) => {
  res.json({ data: patientDetail(await patients.restore(req.params.id)) });
});
