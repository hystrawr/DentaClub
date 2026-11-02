/*
  Warnings:

  - You are about to drop the column `location_id` on the `appointments` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_location_id_fkey";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "location_id";
