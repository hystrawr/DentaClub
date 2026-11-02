-- Nothing schedules recalls, so the interval was never read. AppointmentType
-- keeps its name ("Recall / Cleaning") and duration.

-- AlterTable
ALTER TABLE "appointment_types" DROP COLUMN "recall_interval_months";
