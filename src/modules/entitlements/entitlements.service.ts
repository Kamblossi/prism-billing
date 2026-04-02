import { prisma } from "../../db/prisma.js";
import {
  EntitlementStatus,
  EntitlementType,
} from "../../generated/prisma/index.js";
import { calculateEntitlementWindow } from "../../utils/entitlement-time.js";

type EntitlementDb = Pick<typeof prisma, "entitlement">;

type CreateLicenseEntitlementInput = {
  customerId: string;
  orderId: string;
  appId: string;
  productId: string;
  planId: string;
  accessPeriodUnit: "DAY" | "MONTH" | "YEAR";
  accessPeriodCount: number;
  startAt?: Date;
};

export async function createLicenseEntitlement(
  db: EntitlementDb,
  input: CreateLicenseEntitlementInput,
) {
  const { startsAt, expiresAt } = calculateEntitlementWindow({
    unit: input.accessPeriodUnit,
    count: input.accessPeriodCount,
    startAt: input.startAt,
  });

  return db.entitlement.create({
    data: {
      customerId: input.customerId,
      orderId: input.orderId,
      appId: input.appId,
      productId: input.productId,
      planId: input.planId,
      entitlementType: EntitlementType.LICENSE,
      status: EntitlementStatus.ACTIVE,
      startsAt,
      expiresAt,
    },
  });
}
