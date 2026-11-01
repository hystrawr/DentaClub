-- Two kinds of account: admins run the clinic's settings (services, dentists,
-- chairs); staff run the front desk. New accounts are staff unless made admin.

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'staff');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'staff';

-- The account that existed before roles is the clinic's admin.
UPDATE "users" SET "role" = 'admin' WHERE "username" = 'admin';
