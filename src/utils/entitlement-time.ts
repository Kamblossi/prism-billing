import { addDays, addMonths, addYears } from "date-fns";
import { AccessPeriodUnit, EntitlementStatus } from "../generated/prisma/client.js";

export type EntitlementWindowInput = {
  startAt?: Date;
  unit: AccessPeriodUnit;
  count: number;
};

export type EntitlementWindow = {
  startsAt: Date;
  expiresAt: Date;
};

export function calculateEntitlementWindow(input: EntitlementWindowInput): EntitlementWindow {
  const startsAt = input.startAt ?? new Date();

  if (!Number.isInteger(input.count) || input.count <= 0) {
    throw new Error("accessPeriodCount must be a positive integer");
  }

  const expiresAt = addByCalendarUnit(startsAt, input.unit, input.count);

  return {
    startsAt,
    expiresAt,
  };
}

export function isEntitlementActive(params: {
  status: EntitlementStatus;
  startsAt: Date;
  expiresAt: Date | null;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();

  if (params.status !== EntitlementStatus.ACTIVE) {
    return false;
  }

  if (now < params.startsAt) {
    return false;
  }

  if (params.expiresAt == null) {
    return true;
  }

  // Option A: access expires at an exact timestamp, not end-of-day.
  return now < params.expiresAt;
}

function addByCalendarUnit(start: Date, unit: AccessPeriodUnit, count: number): Date {
  switch (unit) {
    case AccessPeriodUnit.DAY:
      return addDays(start, count);
    case AccessPeriodUnit.MONTH:
      return addMonths(start, count);
    case AccessPeriodUnit.YEAR:
      return addYears(start, count);
    default:
      throw new Error(`Unsupported access period unit: ${String(unit)}`);
  }
}
