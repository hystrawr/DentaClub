import { Router } from "express";
import { z } from "zod";
import type { MedicalHistory } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";
import { isoOffset } from "../lib/dates.js";

// The medical history from the clinic's paper dental record, one per patient.
// Mounted at /api.
export const medicalHistoryRouter = Router();

/** Yes/No questions: wire name → column. */
const YES_NO = {
  in_good_health: "inGoodHealth",
  rheumatic_fever: "rheumaticFever",
  heart_condition: "heartCondition",
  diabetes: "diabetes",
  kidney_disease: "kidneyDisease",
  high_blood_pressure: "highBloodPressure",
  anemia: "anemia",
  hepatitis: "hepatitis",
  asthma: "asthma",
  epilepsy: "epilepsy",
  has_allergies: "hasAllergies",
  allergic_to_penicillin: "allergicToPenicillin",
  taking_medicine: "takingMedicine",
  under_physician_care: "underPhysicianCare",
  pregnant: "pregnant",
  bleeder: "bleeder",
  on_menstruation: "onMenstruation",
} as const satisfies Record<string, keyof MedicalHistory>;

/** Written answers: wire name → column. */
const TEXT = {
  other_allergies: "otherAllergies",
  physician_care_reason: "physicianCareReason",
  previous_extraction: "previousExtraction",
} as const satisfies Record<string, keyof MedicalHistory>;

type Wire = Record<keyof typeof YES_NO, boolean | null> & Record<keyof typeof TEXT, string | null>;

/** Every answer is required in the body, as `null` when not asked — a save writes the whole form. */
const saveHistory = z.object({
  ...Object.fromEntries(Object.keys(YES_NO).map((k) => [k, z.boolean().nullable()])),
  ...Object.fromEntries(
    Object.keys(TEXT).map((k) => [
      k,
      z.string().trim().max(1000).transform((s) => (s === "" ? null : s)).nullable(),
    ]),
  ),
}) as unknown as z.ZodType<Wire>;

function resource(history: MedicalHistory | null) {
  const answers = {} as Wire;
  for (const [wire, column] of Object.entries(YES_NO)) {
    (answers as Record<string, unknown>)[wire] = history?.[column] ?? null;
  }
  for (const [wire, column] of Object.entries(TEXT)) {
    (answers as Record<string, unknown>)[wire] = history?.[column] ?? null;
  }
  return { ...answers, updated_at: isoOffset(history?.updatedAt) };
}

function toData(dto: Wire) {
  const data: Record<string, boolean | string | null> = {};
  for (const [wire, column] of Object.entries(YES_NO)) data[column] = dto[wire as keyof typeof YES_NO];
  for (const [wire, column] of Object.entries(TEXT)) data[column] = dto[wire as keyof typeof TEXT];
  return data;
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
