-- Replace the multi-form intake system (templates, packets, links, guardians)
-- with one consent form signed in the clinic. Signed PDFs in "documents" are kept.

-- DropForeignKey
ALTER TABLE "guardian_links" DROP CONSTRAINT "guardian_links_guardian_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "guardian_links" DROP CONSTRAINT "guardian_links_ward_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "intake_packet_items" DROP CONSTRAINT "intake_packet_items_packet_id_fkey";

-- DropForeignKey
ALTER TABLE "intake_packet_items" DROP CONSTRAINT "intake_packet_items_template_id_fkey";

-- DropForeignKey
ALTER TABLE "intake_submissions" DROP CONSTRAINT "intake_submissions_appointment_id_fkey";

-- DropForeignKey
ALTER TABLE "intake_submissions" DROP CONSTRAINT "intake_submissions_document_id_fkey";

-- DropForeignKey
ALTER TABLE "intake_submissions" DROP CONSTRAINT "intake_submissions_packet_id_fkey";

-- DropForeignKey
ALTER TABLE "intake_submissions" DROP CONSTRAINT "intake_submissions_patient_id_fkey";

-- DropForeignKey
ALTER TABLE "intake_templates" DROP CONSTRAINT "intake_templates_parent_template_id_fkey";

-- DropTable
DROP TABLE "guardian_links";

-- DropTable
DROP TABLE "intake_packet_items";

-- DropTable
DROP TABLE "intake_packets";

-- DropTable
DROP TABLE "intake_submissions";

-- DropTable
DROP TABLE "intake_templates";

-- DropEnum
DROP TYPE "GuardianRelationship";

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "form_text" TEXT NOT NULL,
    "signer_name" TEXT NOT NULL,
    "signer_relationship" TEXT,
    "signature_image" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consents_document_id_key" ON "consents"("document_id");

-- CreateIndex
CREATE INDEX "consents_patient_id_signed_at_idx" ON "consents"("patient_id", "signed_at");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

