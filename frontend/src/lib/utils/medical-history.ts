import type { MedicalHistoryAnswers } from "@/types/api";

/**
 * The medical history questions, worded and grouped as on the clinic's paper
 * dental record. The overview and the edit dialog both read this list, so a
 * question is added or reworded in one place.
 */

type YesNoKey = { [K in keyof MedicalHistoryAnswers]: MedicalHistoryAnswers[K] extends boolean | null ? K : never }[keyof MedicalHistoryAnswers];
type TextKey = Exclude<keyof MedicalHistoryAnswers, YesNoKey>;

export interface Question {
  key: YesNoKey;
  label: string;
  /** The answer the dentist should notice. Usually "Yes"; for "in good health", "No". */
  concernIf?: boolean;
  /** A written follow-up shown with this question (e.g. "If so, for what?"). */
  detail?: { key: TextKey; label: string };
}

export interface QuestionGroup {
  title: string | null;
  questions: Question[];
  /** Written-only questions in this group (no Yes/No). */
  text?: Array<{ key: TextKey; label: string }>;
  /** Shown for female patients, or whenever something in it was answered. */
  womenOnly?: boolean;
}

export const MEDICAL_HISTORY: QuestionGroup[] = [
  {
    title: null,
    questions: [{ key: "in_good_health", label: "Are you in good health?", concernIf: false }],
  },
  {
    title: "Have you ever had any of the following?",
    questions: [
      { key: "rheumatic_fever", label: "Rheumatic fever" },
      { key: "heart_condition", label: "A heart condition" },
      { key: "diabetes", label: "Diabetes" },
      { key: "kidney_disease", label: "Kidney disease" },
      { key: "high_blood_pressure", label: "High blood pressure" },
      { key: "anemia", label: "Anemia" },
      { key: "hepatitis", label: "Hepatitis" },
      { key: "asthma", label: "Asthma" },
      { key: "epilepsy", label: "Epilepsy" },
    ],
  },
  {
    title: "Allergies and medication",
    questions: [
      { key: "has_allergies", label: "Any allergies?" },
      {
        key: "allergic_to_penicillin",
        label: "Are you allergic to penicillin?",
        detail: { key: "other_allergies", label: "Other allergies" },
      },
      { key: "taking_medicine", label: "Are you taking any medicine at present?" },
      {
        key: "under_physician_care",
        label: "Are you being treated by a physician?",
        detail: { key: "physician_care_reason", label: "If so, for what?" },
      },
    ],
    text: [{ key: "previous_extraction", label: "Previous extraction" }],
  },
  {
    title: "For women",
    womenOnly: true,
    questions: [
      { key: "pregnant", label: "Pregnant?" },
      { key: "bleeder", label: "Bleeder?" },
      { key: "on_menstruation", label: "On menstruation today?" },
    ],
  },
];

/** Every answer `null` — the shape of a history nobody has filled in. */
export function emptyAnswers(): MedicalHistoryAnswers {
  const answers: Record<string, null> = {};
  for (const group of MEDICAL_HISTORY) {
    for (const q of group.questions) {
      answers[q.key] = null;
      if (q.detail) answers[q.detail.key] = null;
    }
    for (const t of group.text ?? []) answers[t.key] = null;
  }
  return answers as unknown as MedicalHistoryAnswers;
}

/** Whether a "For women" group applies: a female patient, or anything already answered in it. */
export function showGroup(group: QuestionGroup, sex: string | undefined, answers: MedicalHistoryAnswers): boolean {
  if (!group.womenOnly) return true;
  return sex === "female" || group.questions.some((q) => answers[q.key] !== null);
}
