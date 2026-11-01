-- Appointment types double as the clinic's services, each with one price.
-- Nullable: block time (lunch, meetings) has no price, and existing types
-- start unpriced until the clinic enters its own.

-- AlterTable
ALTER TABLE "appointment_types" ADD COLUMN     "price" DECIMAL(10,2);
