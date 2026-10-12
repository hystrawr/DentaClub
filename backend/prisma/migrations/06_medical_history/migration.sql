-- Patient details and the medical history from the clinic's paper dental record.

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "civil_status" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "referred_by" TEXT;

-- CreateTable
CREATE TABLE "medical_histories" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "in_good_health" BOOLEAN,
    "rheumatic_fever" BOOLEAN,
    "heart_condition" BOOLEAN,
    "diabetes" BOOLEAN,
    "kidney_disease" BOOLEAN,
    "high_blood_pressure" BOOLEAN,
    "anemia" BOOLEAN,
    "hepatitis" BOOLEAN,
    "asthma" BOOLEAN,
    "epilepsy" BOOLEAN,
    "has_allergies" BOOLEAN,
    "allergic_to_penicillin" BOOLEAN,
    "other_allergies" TEXT,
    "taking_medicine" BOOLEAN,
    "under_physician_care" BOOLEAN,
    "physician_care_reason" TEXT,
    "previous_extraction" TEXT,
    "pregnant" BOOLEAN,
    "bleeder" BOOLEAN,
    "on_menstruation" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "medical_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "medical_histories_patient_id_key" ON "medical_histories"("patient_id");

-- AddForeignKey
ALTER TABLE "medical_histories" ADD CONSTRAINT "medical_histories_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

