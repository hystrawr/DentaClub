import { z } from "zod";
import type { MedicalHistory } from "../generated/prisma/client.js";
import { isoOffset } from "../lib/dates.js";

// The medical history's answers and how they map to columns: Blocks B and C
// and Section 13 of the Patient Information Record. Shared by the medical
// history route and new-patient registration, so both apply the same rules.

/** Yes/No questions: wire name → column. */
const YES_NO = {
  in_good_health: "inGoodHealth",
  under_physician_care: "underPhysicianCare",
  serious_illness: "seriousIllness",
  hospitalized: "hospitalized",
  taking_medicine: "takingMedicine",
  uses_tobacco: "usesTobacco",
  uses_drugs: "usesDrugs",
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

/** Item 8, the allergy cards. Any of them ticked, or one written in, sets `has_allergies`. */
const ALLERGENS = [
  "allergicToLocalAnesthetic",
  "allergicToPenicillin",
  "allergicToSulfa",
  "allergicToAspirin",
  "allergicToLatex",
] as const satisfies ReadonlyArray<keyof MedicalHistory>;

/**
 * Section 13, "Do you have or have you had any of the following?". Each code
 * is a row of `medical_conditions`; a ticked box is a row of
 * `medical_history_conditions`.
 */
const CONDITION_CODES = [
  "high_blood_pressure",
  "epilepsy",
  "heart_disease",
  "hepatitis_liver",
  "rheumatic_fever",
  "kidney_disease",
  "diabetes",
  "anemia",
  "asthma",
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

/**
 * Every answer is required in the body, as `null` when not asked — a save
 * writes the whole form. `has_allergies` is not an answer: the server works it
 * out, and ignores one sent in.
 */
export const saveHistory = z.object({
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

export type HistoryInput = z.infer<typeof saveHistory>;

/** Read a history with this, so `historyResource` has its ticked conditions. */
export const withConditions = { conditions: { select: { conditionCode: true } } } as const;

type HistoryWithConditions = MedicalHistory & { conditions: Array<{ conditionCode: string }> };

/** The wire form of a saved history; every answer null when there is none yet. */
export function historyResource(history: HistoryWithConditions | null) {
  const answers: Record<string, unknown> = {};
  for (const [wire, column] of Object.entries(YES_NO)) answers[wire] = history?.[column] ?? null;
  for (const [wire, column] of Object.entries(TEXT)) answers[wire] = history?.[column] ?? null;

  // Checklist order, not the order the rows happen to come back in.
  const ticked = new Set(history?.conditions.map((c) => c.conditionCode));
  const conditions = CONDITION_CODES.filter((code) => ticked.has(code));

  return {
    ...(answers as Omit<HistoryInput, "last_dental_visit" | "dental_anxiety" | "blood_type" | "bp_systolic" | "bp_diastolic" | "conditions">),
    has_allergies: history?.hasAllergies ?? null,
    last_dental_visit: history?.lastDentalVisit ?? null,
    dental_anxiety: history?.dentalAnxiety ?? null,
    blood_type: history?.bloodType ?? null,
    bp_systolic: history?.bpSystolic ?? null,
    bp_diastolic: history?.bpDiastolic ?? null,
    conditions,
    updated_at: isoOffset(history?.updatedAt),
  };
}

/**
 * Answers on the wire → columns, for a create. For an update, clear the
 * ticked conditions first (`conditions: { deleteMany: {}, ...data.conditions }`):
 * a save replaces the whole checklist.
 */
export function historyData(dto: HistoryInput) {
  const data: Record<string, unknown> = {};
  for (const [wire, column] of Object.entries(YES_NO)) data[column] = dto[wire as keyof typeof YES_NO];
  for (const [wire, column] of Object.entries(TEXT)) data[column] = dto[wire as keyof typeof TEXT];

  const hasAllergies = ALLERGENS.some((column) => data[column] === true) || dto.other_allergies !== null;

  return {
    ...data,
    hasAllergies,
    lastDentalVisit: dto.last_dental_visit,
    dentalAnxiety: dto.dental_anxiety,
    bloodType: dto.blood_type,
    bpSystolic: dto.bp_systolic,
    bpDiastolic: dto.bp_diastolic,
    // A saved checklist is an answered one: a box with no row is a "No".
    conditions: { create: [...new Set(dto.conditions)].map((conditionCode) => ({ conditionCode })) },
  };
}
