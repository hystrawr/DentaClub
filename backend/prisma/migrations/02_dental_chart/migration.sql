-- DropForeignKey
ALTER TABLE "dental_charts" DROP CONSTRAINT "dental_charts_patient_id_fkey";

-- DropTable
DROP TABLE "dental_charts";

-- CreateTable
CREATE TABLE "odontogram_events" (
    "id" BIGSERIAL NOT NULL,
    "patient_id" TEXT NOT NULL,
    "tooth_number" SMALLINT NOT NULL,
    "surfaces" JSONB,
    "event_type" TEXT NOT NULL,
    "condition_code" TEXT,
    "notes" TEXT,
    "replaces_event_id" BIGINT,
    "supersession_type" VARCHAR(20),
    "supersession_reason" TEXT,
    "observed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odontogram_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odontogram_events_patient_id_tooth_number_idx" ON "odontogram_events"("patient_id", "tooth_number");

-- CreateIndex
CREATE INDEX "odontogram_events_patient_id_observed_at_idx" ON "odontogram_events"("patient_id", "observed_at");

-- AddForeignKey
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_events_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_events_replaces_event_id_fkey" FOREIGN KEY ("replaces_event_id") REFERENCES "odontogram_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Supersession rules (copied from DentalOS) ─────────────────────────────
-- Prisma cannot express CHECK constraints, so they live here. Each one turns a
-- silent clinical-record bug into a database error.

-- A supersession pointer and its type come together or not at all.
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_supersession_paired"
  CHECK (("replaces_event_id" IS NULL) = ("supersession_type" IS NULL));

-- FHIR vocabulary only.
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_supersession_type_known"
  CHECK ("supersession_type" IS NULL
         OR "supersession_type" IN ('amendment', 'correction', 'entered-in-error'));

-- A retraction (entered-in-error) withdraws a finding; it asserts no condition.
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_retraction_asserts_nothing"
  CHECK ("supersession_type" <> 'entered-in-error' OR "condition_code" IS NULL);

-- A retraction must say why.
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_retraction_states_reason"
  CHECK ("supersession_type" <> 'entered-in-error' OR "supersession_reason" IS NOT NULL);

-- An event cannot supersede itself.
ALTER TABLE "odontogram_events" ADD CONSTRAINT "odontogram_no_self_supersession"
  CHECK ("replaces_event_id" IS NULL OR "replaces_event_id" <> "id");
