import type { MedicalHistoryAnswers } from "@/types/api";

/**
 * The questions of the Patient Information Record (Blocks B, C and Section 13),
 * worded and numbered as on the clinic's paper form. The form reads these
 * lists, so a question is added or reworded in one place.
 */

type YesNoKey = { [K in keyof MedicalHistoryAnswers]: MedicalHistoryAnswers[K] extends boolean | null ? K : never }[keyof MedicalHistoryAnswers];
type TextKey = { [K in keyof MedicalHistoryAnswers]: MedicalHistoryAnswers[K] extends string | null ? K : never }[keyof MedicalHistoryAnswers];

export interface Question {
  key: YesNoKey;
  label: string;
  /** A written follow-up, shown once the answer is "Yes". */
  detail?: { key: TextKey; label: string };
}

/** Block C, questions 1–7. */
export const SCREENING: Question[] = [
  { key: "in_good_health", label: "1. Are you in good health?" },
  {
    key: "under_physician_care",
    label: "2. Are you under medical treatment now?",
    detail: { key: "physician_care_reason", label: "If so, what condition is being treated?" },
  },
  {
    key: "serious_illness",
    label: "3. Have you ever had a serious illness or surgical operation?",
    detail: { key: "serious_illness_detail", label: "If so, what illness or operation?" },
  },
  {
    key: "hospitalized",
    label: "4. Have you ever been hospitalized?",
    detail: { key: "hospitalized_detail", label: "If so, when and why?" },
  },
  {
    key: "taking_medicine",
    label: "5. Are you taking any prescription or non-prescription medication?",
    detail: { key: "medication_detail", label: "Please specify" },
  },
  { key: "uses_tobacco", label: "6. Do you use tobacco products? (cigarettes, vape, chewing)" },
  {
    key: "uses_drugs",
    label: "7. Do you use alcohol, cocaine or other dangerous drugs?",
    detail: { key: "drugs_detail", label: "Please specify" },
  },
];

/** Block C, item 8. "Others" is the `other_allergies` text, not a column of its own. */
export const ALLERGENS: Array<{ key: YesNoKey; label: string }> = [
  { key: "allergic_to_local_anesthetic", label: "Local Anesthetic (e.g. Lidocaine)" },
  { key: "allergic_to_penicillin", label: "Penicillin / Antibiotics" },
  { key: "allergic_to_sulfa", label: "Sulfa Drugs" },
  { key: "allergic_to_aspirin", label: "Aspirin" },
  { key: "allergic_to_latex", label: "Latex" },
];

/** Block C, item 10. */
export const WOMEN_ONLY: Array<{ key: YesNoKey; label: string }> = [
  { key: "pregnant", label: "Pregnant" },
  { key: "nursing", label: "Nursing" },
  { key: "birth_control_pills", label: "Taking birth control pills" },
  { key: "on_menstruation", label: "On menstruation today" },
];

/** Section 13, in the paper form's column order. Codes match the API's. */
export const CONDITIONS: Array<{ code: string; label: string }> = [
  { code: "high_blood_pressure", label: "High Blood Pressure" },
  { code: "low_blood_pressure", label: "Low Blood Pressure" },
  { code: "epilepsy", label: "Epilepsy / Convulsions" },
  { code: "aids_hiv", label: "AIDS or HIV Infection" },
  { code: "std", label: "Sexually Transmitted Disease" },
  { code: "stomach_ulcers", label: "Stomach Troubles / Ulcers" },
  { code: "fainting_seizure", label: "Fainting Seizure" },
  { code: "rapid_weight_loss", label: "Rapid Weight Loss" },
  { code: "radiation_therapy", label: "Radiation Therapy" },
  { code: "joint_replacement", label: "Joint Replacement / Implant" },
  { code: "heart_surgery", label: "Heart Surgery" },
  { code: "heart_attack", label: "Heart Attack" },
  { code: "thyroid", label: "Thyroid Problem" },
  { code: "heart_disease", label: "Heart Disease" },
  { code: "heart_murmur", label: "Heart Murmur" },
  { code: "hepatitis_liver", label: "Hepatitis / Liver Disease" },
  { code: "rheumatic_fever", label: "Rheumatic Fever" },
  { code: "hay_fever", label: "Hay Fever / Allergies" },
  { code: "respiratory", label: "Respiratory Problems" },
  { code: "hepatitis_jaundice", label: "Hepatitis / Jaundice" },
  { code: "tuberculosis", label: "Tuberculosis" },
  { code: "swollen_ankles", label: "Swollen Ankles" },
  { code: "kidney_disease", label: "Kidney Disease" },
  { code: "diabetes", label: "Diabetes" },
  { code: "chest_pain", label: "Chest Pain" },
  { code: "stroke", label: "Stroke" },
  { code: "cancer", label: "Cancer / Tumors" },
  { code: "anemia", label: "Anemia" },
  { code: "angina", label: "Angina" },
  { code: "asthma", label: "Asthma" },
  { code: "emphysema", label: "Emphysema" },
  { code: "bleeding_problems", label: "Bleeding Problems" },
  { code: "blood_diseases", label: "Blood Diseases" },
  { code: "head_injuries", label: "Head Injuries" },
  { code: "arthritis", label: "Arthritis / Rheumatism" },
];

export const FLOSSING = ["Never", "Rarely", "A few times a week", "Once daily", "Twice daily"] as const;

/** Every answer empty — the shape of a history nobody has filled in. */
export function emptyAnswers(): MedicalHistoryAnswers {
  return {
    previous_dentist: null,
    last_dental_visit: null,
    dental_anxiety: null,
    flossing_frequency: null,
    previous_extraction: null,
    physician_name: null,
    physician_specialty: null,
    physician_address: null,
    physician_phone: null,
    in_good_health: null,
    under_physician_care: null,
    physician_care_reason: null,
    serious_illness: null,
    serious_illness_detail: null,
    hospitalized: null,
    hospitalized_detail: null,
    taking_medicine: null,
    medication_detail: null,
    uses_tobacco: null,
    uses_drugs: null,
    drugs_detail: null,
    has_allergies: null,
    allergic_to_local_anesthetic: null,
    allergic_to_penicillin: null,
    allergic_to_sulfa: null,
    allergic_to_aspirin: null,
    allergic_to_latex: null,
    other_allergies: null,
    bleeder: null,
    pregnant: null,
    nursing: null,
    birth_control_pills: null,
    on_menstruation: null,
    blood_type: null,
    bp_systolic: null,
    bp_diastolic: null,
    conditions: [],
    other_conditions: null,
  };
}

/** Whether item 10 applies: a female patient, or anything already answered in it. */
export function showWomenOnly(sex: string | undefined, answers: MedicalHistoryAnswers): boolean {
  return sex === "female" || WOMEN_ONLY.some((q) => answers[q.key] !== null);
}

/** The allergies on file, by name — what the red badge counts. */
export function allergiesOnFile(answers: MedicalHistoryAnswers): string[] {
  return [
    ...ALLERGENS.filter((a) => answers[a.key] === true).map((a) => a.label),
    ...(answers.other_allergies ? [answers.other_allergies] : []),
  ];
}

/**
 * Ready to save. The allergy cards and the checklist are tick-or-not, so once
 * the form is saved an unticked allergy is a "No"; `has_allergies` is kept in
 * step with them.
 */
export function toSave(answers: MedicalHistoryAnswers): MedicalHistoryAnswers {
  const allergies = Object.fromEntries(ALLERGENS.map((a) => [a.key, answers[a.key] === true]));
  return {
    ...answers,
    ...allergies,
    has_allergies: allergiesOnFile(answers).length > 0,
  };
}
