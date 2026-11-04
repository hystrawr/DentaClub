-- Weak-entity keys.
--
-- A treatment record is identified by its patient and position on the sheet,
-- and an availability window by its dentist, day and start time. Both were
-- only indexed, so the database allowed duplicates; now it refuses them.
-- Each unique index replaces the plain index it covers.

-- ── Treatment records ───────────────────────────────────────────────────

-- Renumber each patient's rows 0..n in their current order, in case two
-- rows share a position.
UPDATE "treatment_records" AS t
SET "position" = r.rn
FROM (
  SELECT "id", (ROW_NUMBER() OVER (PARTITION BY "patient_id" ORDER BY "position", "id") - 1) AS rn
  FROM "treatment_records"
) AS r
WHERE t."id" = r."id" AND t."position" <> r.rn;

-- DropIndex
DROP INDEX "treatment_records_patient_id_position_idx";

-- CreateIndex
CREATE UNIQUE INDEX "treatment_records_patient_id_position_key" ON "treatment_records"("patient_id", "position");

-- ── Provider availabilities ─────────────────────────────────────────────

-- Keep one window per dentist, day and start time: the one that runs longest.
DELETE FROM "provider_availabilities" AS a
USING "provider_availabilities" AS b
WHERE a."provider_profile_id" = b."provider_profile_id"
  AND a."day_of_week" = b."day_of_week"
  AND a."start_time" = b."start_time"
  AND (a."end_time" < b."end_time" OR (a."end_time" = b."end_time" AND a."id" > b."id"));

-- DropIndex
DROP INDEX "provider_availabilities_provider_profile_id_day_of_week_idx";

-- CreateIndex
CREATE UNIQUE INDEX "provider_availabilities_provider_profile_id_day_of_week_sta_key" ON "provider_availabilities"("provider_profile_id", "day_of_week", "start_time");
