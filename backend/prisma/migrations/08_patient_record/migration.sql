-- The redesigned Patient Information Record (Blocks A–C and Section 13) and the
-- Treatment Record sheet. Additive only: no column is dropped or renamed, so
-- every answer already recorded keeps its place.

-- AlterTable: Block A
ALTER TABLE "patients" ADD COLUMN     "suffix" VARCHAR(10),
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "home_office_phone" VARCHAR(30),
ADD COLUMN     "insurance_carrier" TEXT,
ADD COLUMN     "insurance_effective" TEXT,
ADD COLUMN     "chief_complaint" TEXT,
ADD COLUMN     "guardian_name" TEXT,
ADD COLUMN     "guardian_occupation" TEXT,
ADD COLUMN     "guardian_contact" VARCHAR(30);

-- AlterTable: Blocks B, C and Section 13
ALTER TABLE "medical_histories" ADD COLUMN     "previous_dentist" TEXT,
ADD COLUMN     "last_dental_visit" VARCHAR(7),
ADD COLUMN     "dental_anxiety" VARCHAR(10),
ADD COLUMN     "flossing_frequency" TEXT,
ADD COLUMN     "physician_name" TEXT,
ADD COLUMN     "physician_specialty" TEXT,
ADD COLUMN     "physician_address" TEXT,
ADD COLUMN     "physician_phone" VARCHAR(30),
ADD COLUMN     "serious_illness" BOOLEAN,
ADD COLUMN     "serious_illness_detail" TEXT,
ADD COLUMN     "hospitalized" BOOLEAN,
ADD COLUMN     "hospitalized_detail" TEXT,
ADD COLUMN     "medication_detail" TEXT,
ADD COLUMN     "uses_tobacco" BOOLEAN,
ADD COLUMN     "uses_drugs" BOOLEAN,
ADD COLUMN     "drugs_detail" TEXT,
ADD COLUMN     "allergic_to_local_anesthetic" BOOLEAN,
ADD COLUMN     "allergic_to_sulfa" BOOLEAN,
ADD COLUMN     "allergic_to_aspirin" BOOLEAN,
ADD COLUMN     "allergic_to_latex" BOOLEAN,
ADD COLUMN     "nursing" BOOLEAN,
ADD COLUMN     "birth_control_pills" BOOLEAN,
ADD COLUMN     "blood_type" VARCHAR(3),
ADD COLUMN     "bp_systolic" SMALLINT,
ADD COLUMN     "bp_diastolic" SMALLINT,
ADD COLUMN     "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "other_conditions" TEXT;

-- CreateTable
CREATE TABLE "treatment_records" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "position" SMALLINT NOT NULL,
    "visit_date" DATE,
    "teeth" VARCHAR(50),
    "procedure" TEXT,
    "doctor" TEXT,
    "amount_charged" DECIMAL(10,2),
    "amount_paid" DECIMAL(10,2),
    "next_appointment" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "treatment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "treatment_records_patient_id_position_idx" ON "treatment_records"("patient_id", "position");

-- AddForeignKey
ALTER TABLE "treatment_records" ADD CONSTRAINT "treatment_records_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
