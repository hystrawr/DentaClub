-- CreateEnum
CREATE TYPE "GuardianRelationship" AS ENUM ('parent', 'legal_guardian', 'grandparent', 'sibling', 'other');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('id_scan', 'referral', 'lab_result', 'consent', 'treatment_plan_signature', 'signed_consent', 'other');

-- DropForeignKey
ALTER TABLE "consent_records" DROP CONSTRAINT "consent_records_patient_id_fkey";

-- DropTable
DROP TABLE "consent_records";

-- CreateTable
CREATE TABLE "guardian_links" (
    "id" TEXT NOT NULL,
    "guardian_patient_id" TEXT NOT NULL,
    "ward_patient_id" TEXT NOT NULL,
    "relationship" "GuardianRelationship" NOT NULL,
    "consent_authority_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "guardian_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" SMALLINT NOT NULL DEFAULT 1,
    "parent_template_id" TEXT,
    "fields_schema" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intake_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_packets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intake_packets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_packet_items" (
    "id" TEXT NOT NULL,
    "packet_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intake_packet_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intake_submissions" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "packet_id" TEXT NOT NULL,
    "appointment_id" TEXT,
    "token_hash" CHAR(64) NOT NULL,
    "responses" JSONB,
    "completed_at" TIMESTAMPTZ(6),
    "document_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "intake_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "file_data" BYTEA,
    "mime_type" TEXT,
    "file_name" TEXT,
    "size_bytes" INTEGER,
    "immutable_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_links_guardian_patient_id_ward_patient_id_key" ON "guardian_links"("guardian_patient_id", "ward_patient_id");

-- CreateIndex
CREATE INDEX "intake_templates_is_active_idx" ON "intake_templates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "intake_packet_items_packet_id_template_id_key" ON "intake_packet_items"("packet_id", "template_id");

-- CreateIndex
CREATE UNIQUE INDEX "intake_submissions_token_hash_key" ON "intake_submissions"("token_hash");

-- CreateIndex
CREATE INDEX "intake_submissions_patient_id_completed_at_idx" ON "intake_submissions"("patient_id", "completed_at");

-- CreateIndex
CREATE INDEX "documents_patient_id_idx" ON "documents"("patient_id");

-- AddForeignKey
ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_guardian_patient_id_fkey" FOREIGN KEY ("guardian_patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_ward_patient_id_fkey" FOREIGN KEY ("ward_patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_templates" ADD CONSTRAINT "intake_templates_parent_template_id_fkey" FOREIGN KEY ("parent_template_id") REFERENCES "intake_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_packet_items" ADD CONSTRAINT "intake_packet_items_packet_id_fkey" FOREIGN KEY ("packet_id") REFERENCES "intake_packets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_packet_items" ADD CONSTRAINT "intake_packet_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "intake_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_packet_id_fkey" FOREIGN KEY ("packet_id") REFERENCES "intake_packets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intake_submissions" ADD CONSTRAINT "intake_submissions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

