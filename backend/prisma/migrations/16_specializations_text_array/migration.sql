-- A dentist's specializations were JSONB, so any shape could be stored. They
-- are a list of names, so they become TEXT[]. A JSON array is copied element by
-- element; anything else (null, or not an array) becomes an empty list.

-- AlterTable
ALTER TABLE "provider_profiles" ADD COLUMN "specializations_new" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "provider_profiles"
SET "specializations_new" = ARRAY(SELECT jsonb_array_elements_text("specializations"))
WHERE jsonb_typeof("specializations") = 'array';

ALTER TABLE "provider_profiles" DROP COLUMN "specializations";
ALTER TABLE "provider_profiles" RENAME COLUMN "specializations_new" TO "specializations";
