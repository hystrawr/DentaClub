import { Router } from "express";
import { z } from "zod";
import type { MedicalHistory } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";
import { isoOffset } from "../lib/dates.js";

// The medical history from the clinic's paper dental record, one per patient:
// Blocks B and C and Section 13 of the Patient Information Record.
// Mounted at /api.
export const medicalHistoryRouter = Router();

/** Yes/No questions: wire name → column. */
const YES_NO = {
  in_good_health: "inGoodHealth",
  under_physician_care: "underPhysicianCare",
  serious_illness: "seriousIllness",
  hospitalized: "hospitalized",
  taking_medicine: "takingMedicine",
  uses_tobacco: "usesTobacco",
  uses_drugs: "usesDrugs",
  has_allergies: "hasAllergies",
  allergic_to_local_anesthetic: "allergicToLocalAnesthetic",
  allergic_to_penicillin: "allergicToPenicillin",
  allergic_to_sulfa: "allergicToSulfa",
  allergic_to_aspirin: "allergicToAspirin",
  allergic_to_latex: "allergicToLatex",
  bleeder: "bleeder",
  pregnant: "pregnant",
  nursing: "nursing",
  birth_control_pills: "birthControlPills",
  on_menstruation: "onMenstruation",
} as const satisfies Record<string, keyof MedicalHistory>;

/** Written answers: wire name → column. */
const TEXT = {
  previous_dentist: "previousDentist",
  flossing_frequency: "flossingFrequency",
  previous_extraction: "previousExtraction",
  physician_name: "physicianName",
  physician_specialty: "physicianSpecialty",
  physician_address: "physicianAddress",
  physician_phone: "physicianPhone",
  physician_care_reason: "physicianCareReason",
  serious_illness_detail: "seriousIllnessDetail",
  hospitalized_detail: "hospitalizedDetail",
  medication_detail: "medicationDetail",
  drugs_detail: "drugsDetail",
  other_allergies: "otherAllergies",
  other_conditions: "otherConditions",
} as const satisfies Record<string, keyof MedicalHistory>;

/**
 * Section 13, "Do you have or have you had any of the following?".
 *
 * Nine of these were Yes/No questions on the old form and keep their columns,
 * so nothing already recorded moves. The rest are stored by code in
 * `conditions`. The API shows both as one list of codes.
 */
const CONDITION_COLUMNS = {
  high_blood_pressure: "highBloodPressure",
  epilepsy: "epilepsy",
  heart_disease: "heartCondition",
  hepatitis_liver: "hepatitis",
  rheumatic_fever: "rheumaticFever",
  kidney_disease: "kidneyDisease",
  diabetes: "diabetes",
  anemia: "anemia",
  asthma: "asthma",
} as const satisfies Record<string, keyof MedicalHistory>;

const CONDITION_CODES = [
  ...(Object.keys(CONDITION_COLUMNS) as Array<keyof typeof CONDITION_COLUMNS>),
  "low_blood_pressure",
  "aids_hiv",
  "std",
  "stomach_ulcers",
  "fainting_seizure",
  "rapid_weight_loss",
  "radiation_therapy",
  "joint_replacement",
  "heart_surgery",
  "heart_attack",
  "thyroid",
  "heart_murmur",
  "hay_fever",
  "respiratory",
  "hepatitis_jaundice",
  "tuberculosis",
  "swollen_ankles",
  "chest_pain",
  "stroke",
  "cancer",
  "angina",
  "emphysema",
  "bleeding_problems",
  "blood_diseases",
  "head_injuries",
  "arthritis",
] as const;

const ANXIETY = ["low", "moderate", "severe"] as const;
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const text = z.string().trim().max(1000).transform((s) => (s === "" ? null : s)).nullable();
const pressure = z.number().int().min(40).max(300).nullable();

/** Every answer is required in the body, as `null` when not asked — a save writes the whole form. */
const saveHistory = z.object({
  ...(Object.fromEntries(Object.keys(YES_NO).map((k) => [k, z.boolean().nullable()])) as {
    [K in keyof typeof YES_NO]: z.ZodNullable<z.ZodBoolean>;
  }),
  ...(Object.fromEntries(Object.keys(TEXT).map((k) => [k, text])) as { [K in keyof typeof TEXT]: typeof text }),
  last_dental_visit: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "The last dental visit must be a month (YYYY-MM).").nullable(),
  dental_anxiety: z.enum(ANXIETY).nullable(),
  blood_type: z.enum(BLOOD_TYPES).nullable(),
  bp_systolic: pressure,
  bp_diastolic: pressure,
  conditions: z.array(z.enum(CONDITION_CODES)).max(CONDITION_CODES.length),
});

type Wire = z.infer<typeof saveHistory>;

function resource(history: MedicalHistory | null) {
  const answers: Record<string, unknown> = {};
  for (const [wire, column] of Object.entries(YES_NO)) answers[wire] = history?.[column] ?? null;
  for (const [wire, column] of Object.entries(TEXT)) answers[wire] = history?.[column] ?? null;

  const conditions = [
    ...Object.entries(CONDITION_COLUMNS)
      .filter(([, column]) => history?.[column] === true)
      .map(([code]) => code),
    ...(history?.conditions ?? []),
  ];

  return {
    ...(answers as Omit<Wire, "last_dental_visit" | "dental_anxiety" | "blood_type" | "bp_systolic" | "bp_diastolic" | "conditions">),
    last_dental_visit: history?.lastDentalVisit ?? null,
    dental_anxiety: history?.dentalAnxiety ?? null,
    blood_type: history?.bloodType ?? null,
    bp_systolic: history?.bpSystolic ?? null,
    bp_diastolic: history?.bpDiastolic ?? null,
    conditions,
    updated_at: isoOffset(history?.updatedAt),
  };
}

function toData(dto: Wire) {
  const data: Record<string, unknown> = {};
  for (const [wire, column] of Object.entries(YES_NO)) data[column] = dto[wire as keyof typeof YES_NO];
  for (const [wire, column] of Object.entries(TEXT)) data[column] = dto[wire as keyof typeof TEXT];

  // A saved checklist is an answered one: an unticked box is a "No".
  const ticked = new Set<string>(dto.conditions);
  for (const [code, column] of Object.entries(CONDITION_COLUMNS)) data[column] = ticked.has(code);

  return {
    ...data,
    lastDentalVisit: dto.last_dental_visit,
    dentalAnxiety: dto.dental_anxiety,
    bloodType: dto.blood_type,
    bpSystolic: dto.bp_systolic,
    bpDiastolic: dto.bp_diastolic,
    conditions: [...ticked].filter((code) => !(code in CONDITION_COLUMNS)),
  };
}

async function assertPatient(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) throw notFound("Patient not found");
}

/** GET /api/patients/:id/medical-history — every answer null until first saved. */
medicalHistoryRouter.get("/patients/:id/medical-history", async (req, res) => {
  await assertPatient(req.params.id);
  const history = await prisma.medicalHistory.findUnique({ where: { patientId: req.params.id } });
  res.json({ data: resource(history) });
});

/** PUT /api/patients/:id/medical-history — save the whole form. */
medicalHistoryRouter.put("/patients/:id/medical-history", async (req, res) => {
  const dto = saveHistory.parse(req.body);
  await assertPatient(req.params.id);
  const data = toData(dto);
  const history = await prisma.medicalHistory.upsert({
    where: { patientId: req.params.id },
    create: { patientId: req.params.id, ...data },
    update: data,
  });
  res.json({ data: resource(history) });
});
