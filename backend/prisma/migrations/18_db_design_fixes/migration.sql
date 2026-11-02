-- Database design fixes.
--
-- 1. Section 13 conditions move out of medical_histories. Nine were Yes/No
--    columns and the rest a TEXT[] of codes, so one checklist lived in two
--    shapes. Now every condition is a row in `medical_conditions`, and each
--    ticked box a row in `medical_history_conditions`.
-- 2. A dentist's specializations move out of the TEXT[] into
--    `provider_specializations`, one row per specialization.
-- 3. CHECK constraints for the values the app already validates, so the
--    database refuses them too.
-- 4. `has_allergies` is recomputed from the allergy answers; the app now
--    derives it on every save instead of trusting the form.

-- ── 1. Conditions ───────────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "medical_conditions" (
    "code" VARCHAR(30) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "medical_conditions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "medical_history_conditions" (
    "medical_history_id" TEXT NOT NULL,
    "condition_code" VARCHAR(30) NOT NULL,

    CONSTRAINT "medical_history_conditions_pkey" PRIMARY KEY ("medical_history_id","condition_code")
);

-- AddForeignKey
ALTER TABLE "medical_history_conditions" ADD CONSTRAINT "medical_history_conditions_medical_history_id_fkey" FOREIGN KEY ("medical_history_id") REFERENCES "medical_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medical_history_conditions" ADD CONSTRAINT "medical_history_conditions_condition_code_fkey" FOREIGN KEY ("condition_code") REFERENCES "medical_conditions"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The checklist, as printed on the Patient Information Record.
INSERT INTO "medical_conditions" ("code", "label") VALUES
  ('high_blood_pressure', 'High Blood Pressure'),
  ('low_blood_pressure', 'Low Blood Pressure'),
  ('epilepsy', 'Epilepsy / Convulsions'),
  ('aids_hiv', 'AIDS or HIV Infection'),
  ('std', 'Sexually Transmitted Disease'),
  ('stomach_ulcers', 'Stomach Troubles / Ulcers'),
  ('fainting_seizure', 'Fainting Seizure'),
  ('rapid_weight_loss', 'Rapid Weight Loss'),
  ('radiation_therapy', 'Radiation Therapy'),
  ('joint_replacement', 'Joint Replacement / Implant'),
  ('heart_surgery', 'Heart Surgery'),
  ('heart_attack', 'Heart Attack'),
  ('thyroid', 'Thyroid Problem'),
  ('heart_disease', 'Heart Disease'),
  ('heart_murmur', 'Heart Murmur'),
  ('hepatitis_liver', 'Hepatitis / Liver Disease'),
  ('rheumatic_fever', 'Rheumatic Fever'),
  ('hay_fever', 'Hay Fever / Allergies'),
  ('respiratory', 'Respiratory Problems'),
  ('hepatitis_jaundice', 'Hepatitis / Jaundice'),
  ('tuberculosis', 'Tuberculosis'),
  ('swollen_ankles', 'Swollen Ankles'),
  ('kidney_disease', 'Kidney Disease'),
  ('diabetes', 'Diabetes'),
  ('chest_pain', 'Chest Pain'),
  ('stroke', 'Stroke'),
  ('cancer', 'Cancer / Tumors'),
  ('anemia', 'Anemia'),
  ('angina', 'Angina'),
  ('asthma', 'Asthma'),
  ('emphysema', 'Emphysema'),
  ('bleeding_problems', 'Bleeding Problems'),
  ('blood_diseases', 'Blood Diseases'),
  ('head_injuries', 'Head Injuries'),
  ('arthritis', 'Arthritis / Rheumatism');

-- Copy what is on file: a TRUE column, or a code in the array, becomes a row.
INSERT INTO "medical_history_conditions" ("medical_history_id", "condition_code")
SELECT "id", c."code"
FROM "medical_histories"
CROSS JOIN LATERAL (VALUES
  ('high_blood_pressure', "high_blood_pressure"),
  ('epilepsy', "epilepsy"),
  ('heart_disease', "heart_condition"),
  ('hepatitis_liver', "hepatitis"),
  ('rheumatic_fever', "rheumatic_fever"),
  ('kidney_disease', "kidney_disease"),
  ('diabetes', "diabetes"),
  ('anemia', "anemia"),
  ('asthma', "asthma")
) AS c("code", "ticked")
WHERE c."ticked"
UNION
SELECT "id", unnest("conditions")
FROM "medical_histories";

-- AlterTable
ALTER TABLE "medical_histories" DROP COLUMN "anemia",
DROP COLUMN "asthma",
DROP COLUMN "conditions",
DROP COLUMN "diabetes",
DROP COLUMN "epilepsy",
DROP COLUMN "heart_condition",
DROP COLUMN "hepatitis",
DROP COLUMN "high_blood_pressure",
DROP COLUMN "kidney_disease",
DROP COLUMN "rheumatic_fever";

-- ── 2. Specializations ─────────────────────────────────────────────────

-- CreateTable
CREATE TABLE "provider_specializations" (
    "provider_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "provider_specializations_pkey" PRIMARY KEY ("provider_profile_id","name")
);

-- AddForeignKey
ALTER TABLE "provider_specializations" ADD CONSTRAINT "provider_specializations_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DISTINCT: the array could hold the same name twice; the key cannot.
INSERT INTO "provider_specializations" ("provider_profile_id", "name")
SELECT DISTINCT "id", btrim(s)
FROM "provider_profiles", unnest("specializations") AS s
WHERE btrim(s) <> '';

-- AlterTable
ALTER TABLE "provider_profiles" DROP COLUMN "specializations";

-- ── 3. CHECK constraints ───────────────────────────────────────────────
-- A NULL passes a CHECK, so "not answered yet" stays allowed everywhere.

ALTER TABLE "patients" ADD CONSTRAINT "patients_civil_status_known"
  CHECK ("civil_status" IN ('single', 'married', 'widowed', 'separated'));

ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_blood_type_known"
  CHECK ("blood_type" IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'));

ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_dental_anxiety_known"
  CHECK ("dental_anxiety" IN ('low', 'moderate', 'severe'));

ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_bp_systolic_range"
  CHECK ("bp_systolic" BETWEEN 40 AND 300);

ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_bp_diastolic_range"
  CHECK ("bp_diastolic" BETWEEN 40 AND 300);

ALTER TABLE "treatment_records" ADD CONSTRAINT "treatment_records_amount_charged_not_negative"
  CHECK ("amount_charged" >= 0);

ALTER TABLE "treatment_records" ADD CONSTRAINT "treatment_records_amount_paid_not_negative"
  CHECK ("amount_paid" >= 0);

ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_price_not_negative"
  CHECK ("price" >= 0);

ALTER TABLE "appointment_types" ADD CONSTRAINT "appointment_types_duration_positive"
  CHECK ("duration_minutes" > 0);

-- FDI notation: quadrants 1–4 are permanent teeth 1–8, quadrants 5–8 are
-- baby teeth 1–5 (same rule as lib/chart.ts).
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_tooth_number_fdi"
  CHECK (
    ("tooth_number" / 10 BETWEEN 1 AND 4 AND "tooth_number" % 10 BETWEEN 1 AND 8)
    OR ("tooth_number" / 10 BETWEEN 5 AND 8 AND "tooth_number" % 10 BETWEEN 1 AND 5)
  );

ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_event_type_known"
  CHECK ("event_type" IN ('condition', 'procedure', 'treatment'));

-- ── 4. has_allergies ───────────────────────────────────────────────────

UPDATE "medical_histories"
SET "has_allergies" = COALESCE("allergic_to_local_anesthetic", FALSE)
  OR COALESCE("allergic_to_penicillin", FALSE)
  OR COALESCE("allergic_to_sulfa", FALSE)
  OR COALESCE("allergic_to_aspirin", FALSE)
  OR COALESCE("allergic_to_latex", FALSE)
  OR COALESCE(btrim("other_allergies"), '') <> '';
