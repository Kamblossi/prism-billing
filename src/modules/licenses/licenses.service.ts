import crypto from "node:crypto";
import { prisma } from "../../db/prisma.js";
import { LicenseStatus } from "../../generated/prisma/enums.js";

type LicenseDb = Pick<typeof prisma, "license">;

type IssueLicenseInput = {
  entitlementId: string;
  maxDevices: number;
  isAdmin?: boolean;
};

function generateLicenseKey() {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `RIEKO-${part()}-${part()}-${part()}-${part()}`;
}

export async function issueLicenseForEntitlement(
  db: LicenseDb,
  input: IssueLicenseInput,
) {
  const existing = await db.license.findUnique({
    where: { entitlementId: input.entitlementId },
  });

  if (existing) {
    return existing;
  }

  return db.license.create({
    data: {
      entitlementId: input.entitlementId,
      licenseKey: generateLicenseKey(),
      status: LicenseStatus.ACTIVE,
      maxDevices: input.maxDevices,
      isAdmin: input.isAdmin ?? false,
    },
  });
}

export async function activateLicense() {
  throw new Error("Not implemented yet");
}

export async function validateLicense() {
  throw new Error("Not implemented yet");
}

export async function deactivateLicense() {
  throw new Error("Not implemented yet");
}
