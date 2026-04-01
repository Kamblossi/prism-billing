/*
  Warnings:

  - Existing plans are backfilled before the new required access period columns are enforced.

*/
-- CreateEnum
CREATE TYPE "AccessPeriodUnit" AS ENUM ('DAY', 'MONTH', 'YEAR');

-- AlterTable
ALTER TABLE "entitlements" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "access_period_count" INTEGER,
ADD COLUMN     "access_period_unit" "AccessPeriodUnit",
ADD COLUMN     "max_devices" INTEGER NOT NULL DEFAULT 1;

-- Backfill existing plan rows before enforcing NOT NULL
UPDATE "plans"
SET
  "access_period_unit" = CASE
    WHEN "plan_code" = 'pro-monthly' THEN 'MONTH'::"AccessPeriodUnit"
    WHEN "plan_code" = 'pro-yearly' THEN 'YEAR'::"AccessPeriodUnit"
    ELSE 'YEAR'::"AccessPeriodUnit"
  END,
  "access_period_count" = CASE
    WHEN "plan_code" = 'pro-monthly' THEN 1
    WHEN "plan_code" = 'pro-yearly' THEN 1
    ELSE 1
  END,
  "max_devices" = CASE
    WHEN "plan_code" = 'pro-monthly' THEN 1
    WHEN "plan_code" = 'pro-yearly' THEN 2
    ELSE "max_devices"
  END;

ALTER TABLE "plans"
ALTER COLUMN "access_period_count" SET NOT NULL,
ALTER COLUMN "access_period_unit" SET NOT NULL;
