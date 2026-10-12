import { Router } from "express";
import { z } from "zod";
import type { Patient } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";
import { ageFrom, dateString, isoOffset } from "../lib/dates.js";

// Patients, in DentalOS's wire format (snake_case, `{ data }` envelope) so the
// ported frontend reads them unchanged. Mounted at /api/patients.
export const patientsRouter = Router();

const SEX = ["male", "female", "other"] as const;
const CIVIL_STATUS = ["single", "married", "widowed", "separated"] as const;

/** DentalOS: "Juan Santos Dela Cruz" — middle name included when present. */
const fullName = (p: { firstName: string; middleName: string | null; lastName: string }): string =>
  `${p.firstName} ${p.middleName ?? ""} ${p.lastName}`.replace(/\s+/g, " ").trim();

/** `PatientSummaryResource` — the directory and search results. */
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
    middle_name: p.middleName,
    address: p.address,
    occupation: p.occupation,
    civil_status: p.civilStatus,
    referred_by: p.referredBy,
    notes: p.notes,
    created_at: isoOffset(p.createdAt),
    updated_at: isoOffset(p.updatedAt),
  };
}

/**
 * Optional text: a blank input becomes `null` (cleared), and an absent key is
 * left alone. DentalOS's edit form relies on those being different — a deleted
 * wrong phone number must actually be removed on save.
 */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((s) => (s === "" ? null : s))
    .nullish();

const createPatient = z.object({
  first_name: z.string().trim().min(1, "The first name field is required.").max(100),
  last_name: z.string().trim().min(1, "The last name field is required.").max(100),
  middle_name: optionalText(100),
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
});

/** Every field optional: absent = untouched, null = cleared (DentalOS's PartialType). */
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
  };
}

/**
 * GET /api/patients?search=dela
 * Every patient, A–Z by last name then first name — the directory groups them
 * by letter. Search matches first name, last name or mobile number.
 */
patientsRouter.get("/", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const patients = await prisma.patient.findMany({
    where: search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { mobile: { contains: search } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
  });

  res.json({ data: patients.map(patientSummary) });
});

patientsRouter.get("/:id", async (req, res) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.id } });
  if (!patient) throw notFound("Patient not found");
  res.json({ data: patientDetail(patient) });
});

patientsRouter.post("/", async (req, res) => {
  const dto = createPatient.parse(req.body);
  const patient = await prisma.patient.create({
    data: {
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
    },
  });
  res.status(201).json({ data: patientDetail(patient) });
});

/** PATCH /api/patients/:id — partial update. */
patientsRouter.patch("/:id", async (req, res) => {
  const dto = updatePatient.parse(req.body);
  const patient = await prisma.patient.update({ where: { id: req.params.id }, data: toData(dto) });
  res.json({ data: patientDetail(patient) });
});

/** DELETE /api/patients/:id — also removes their chart, consents and documents (appointments are kept, without a patient). */
patientsRouter.delete("/:id", async (req, res) => {
  await prisma.patient.delete({ where: { id: req.params.id } });
  res.status(204).end();
});
