/*
  Warnings:

  - The values [id_scan,referral,lab_result,consent,treatment_plan_signature] on the enum `DocumentType` will be removed. If these variants are still used in the database, this will fail.

*/
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "documents" WHERE "type" NOT IN ('signed_consent', 'other')) THEN
    RAISE EXCEPTION 'documents still use a removed DocumentType';
  END IF;
END $$;

-- AlterEnum
BEGIN;
CREATE TYPE "DocumentType_new" AS ENUM ('signed_consent', 'other');
ALTER TABLE "documents" ALTER COLUMN "type" TYPE "DocumentType_new" USING ("type"::text::"DocumentType_new");
ALTER TYPE "DocumentType" RENAME TO "DocumentType_old";
ALTER TYPE "DocumentType_new" RENAME TO "DocumentType";
DROP TYPE "public"."DocumentType_old";
COMMIT;
