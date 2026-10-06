-- AlterEnum
ALTER TYPE "AppointmentStatus" ADD VALUE 'confirmed';

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_patient_id_fkey";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "arrived_at",
DROP COLUMN "reason",
ADD COLUMN     "actual_end" TIMESTAMPTZ(6),
ADD COLUMN     "actual_start" TIMESTAMPTZ(6),
ADD COLUMN     "appointment_type_id" TEXT,
ADD COLUMN     "cancellation_reason" TEXT,
ADD COLUMN     "location_id" TEXT,
ADD COLUMN     "operatory_id" TEXT,
ADD COLUMN     "provider_profile_id" TEXT NOT NULL,
ALTER COLUMN "patient_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operatories" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" VARCHAR(7),
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operatories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prc_number" TEXT,
    "specializations" JSONB,
    "color_hex" VARCHAR(7) NOT NULL DEFAULT '#3B82F6',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provider_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_availabilities" (
    "id" TEXT NOT NULL,
    "provider_profile_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provider_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration_minutes" SMALLINT NOT NULL DEFAULT 30,
    "color_hex" VARCHAR(7) NOT NULL DEFAULT '#6B7280',
    "is_block_time" BOOLEAN NOT NULL DEFAULT false,
    "recall_interval_months" SMALLINT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "appointment_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operatories_location_id_idx" ON "operatories"("location_id");

-- CreateIndex
CREATE INDEX "provider_availabilities_provider_profile_id_day_of_week_idx" ON "provider_availabilities"("provider_profile_id", "day_of_week");

-- CreateIndex
CREATE INDEX "appointments_operatory_id_scheduled_start_idx" ON "appointments"("operatory_id", "scheduled_start");

-- CreateIndex
CREATE INDEX "appointments_provider_profile_id_scheduled_start_idx" ON "appointments"("provider_profile_id", "scheduled_start");

-- AddForeignKey
ALTER TABLE "operatories" ADD CONSTRAINT "operatories_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_availabilities" ADD CONSTRAINT "provider_availabilities_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_availabilities" ADD CONSTRAINT "provider_availabilities_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_provider_profile_id_fkey" FOREIGN KEY ("provider_profile_id") REFERENCES "provider_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_appointment_type_id_fkey" FOREIGN KEY ("appointment_type_id") REFERENCES "appointment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_operatory_id_fkey" FOREIGN KEY ("operatory_id") REFERENCES "operatories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- An appointment must end after it starts. (Not in DentalOS, which accepts a
-- reversed range and then cannot detect conflicts for it.)
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_end_after_start"
  CHECK ("scheduled_end" > "scheduled_start");

-- A weekly window must close after it opens.
ALTER TABLE "provider_availabilities" ADD CONSTRAINT "provider_availabilities_end_after_start"
  CHECK ("end_time" > "start_time");

-- 0 = Sunday … 6 = Saturday.
ALTER TABLE "provider_availabilities" ADD CONSTRAINT "provider_availabilities_day_of_week_range"
  CHECK ("day_of_week" BETWEEN 0 AND 6);
