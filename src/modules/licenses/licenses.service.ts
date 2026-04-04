import crypto from "node:crypto";
import { prisma } from "../../db/prisma.js";
import {
  ActivationStatus,
  EntitlementStatus,
  LicenseStatus,
  Prisma,
} from "../../generated/prisma/index.js";
import { isEntitlementActive } from "../../utils/entitlement-time.js";

type LicenseDb = Pick<typeof prisma, "license">;

type IssueLicenseInput = {
  entitlementId: string;
  maxDevices: number;
  isAdmin?: boolean;
};

export type LicenseRuntimeCapabilities = {
  cloud_enabled: boolean;
  dev_space_enabled: boolean;
  byok_enabled: boolean;
  allowed_model_keys: string[];
  monthly_generation_limit: number | null;
  trial_request_limit: number | null;
  device_limit: number;
};

export type LicenseTier = "basic" | "pro" | "trial" | "admin";

export type ActivateLicenseInput = {
  licenseKey: string;
  machineId: string;
  instanceId: string;
  appVersion?: string | null;
};

export type ActivateLicenseResult = {
  activated: boolean;
  license_key?: string;
  instance?: {
    id: string;
    name: string;
    created_at?: string;
  };
  is_dev_license: boolean;
  error?: string;
  message?: string;
};

export type ValidateLicenseInput = {
  licenseKey: string;
  machineId: string;
  instanceId: string;
  appVersion?: string | null;
};

export type ValidateLicenseResult = {
  is_active: boolean;
  last_validated_at: string | null;
  is_dev_license: boolean;
  reason?: string;
  plan_code?: string | null;
  tier?: LicenseTier | null;
  capabilities?: LicenseRuntimeCapabilities | null;
};

export type DeactivateLicenseInput = {
  licenseKey: string;
  machineId: string;
  instanceId: string;
};

export type DeactivateLicenseResult = {
  deactivated: boolean;
  license_key: string;
  instance: {
    id: string;
    name: string;
  };
  is_dev_license: boolean;
};

function normalizeLicenseKey(value: string) {
  return value.trim().toUpperCase();
}

async function findLicenseForRuntime(licenseKey: string) {
  return prisma.license.findUnique({
    where: { licenseKey },
    include: {
      entitlement: {
        include: {
          plan: true,
          customer: true,
        },
      },
      activations: true,
      trialRedemption: true,
    },
  });
}

function findMatchingActivation(
  activations: Array<{
    id: string;
    instanceId: string;
    machineId: string;
    status: ActivationStatus;
    activatedAt: Date;
  }>,
  machineId: string,
  instanceId: string,
) {
  return activations.find(
    (item) => item.machineId === machineId && item.instanceId === instanceId,
  );
}

function countActiveActivations(
  activations: Array<{ status: ActivationStatus }>,
) {
  return activations.filter(
    (item) => item.status === ActivationStatus.ACTIVE,
  ).length;
}

function isLicenseRuntimeEligible(license: {
  status: LicenseStatus;
  entitlement: {
    status: EntitlementStatus;
    startsAt: Date;
    expiresAt: Date | null;
  } | null;
}) {
  if (license.status !== LicenseStatus.ACTIVE) {
    return {
      ok: false as const,
      reason: "LICENSE_NOT_ACTIVE",
      message: "License is not active.",
    };
  }

  if (!license.entitlement) {
    return {
      ok: false as const,
      reason: "ENTITLEMENT_MISSING",
      message: "License entitlement is missing.",
    };
  }

  const entitlementActive = isEntitlementActive({
    status: license.entitlement.status,
    startsAt: license.entitlement.startsAt,
    expiresAt: license.entitlement.expiresAt,
  });

  if (!entitlementActive) {
    return {
      ok: false as const,
      reason: "ENTITLEMENT_NOT_ACTIVE",
      message: "The linked entitlement is inactive or expired.",
    };
  }

  return { ok: true as const };
}

function buildRuntimeCapabilities(input: {
  planCode: string | null;
  maxDevices: number;
  isAdmin: boolean;
}): { tier: LicenseTier; capabilities: LicenseRuntimeCapabilities } {
  if (input.isAdmin) {
    return {
      tier: "admin",
      capabilities: {
        cloud_enabled: true,
        dev_space_enabled: true,
        byok_enabled: true,
        allowed_model_keys: [
          "auto",
          "fast",
          "premium",
          "vision",
          "code",
          "audio",
          "audio-auto",
        ],
        monthly_generation_limit: null,
        trial_request_limit: null,
        device_limit: input.maxDevices,
      },
    };
  }

  const normalizedPlan = (input.planCode ?? "").trim().toLowerCase();

  if (normalizedPlan === "limited-trial") {
    return {
      tier: "trial",
      capabilities: {
        cloud_enabled: true,
        dev_space_enabled: false,
        byok_enabled: false,
        allowed_model_keys: ["auto", "fast", "audio", "audio-auto"],
        monthly_generation_limit: null,
        trial_request_limit: 5,
        device_limit: input.maxDevices,
      },
    };
  }

  if (normalizedPlan === "basic-monthly" || normalizedPlan === "basic") {
    return {
      tier: "basic",
      capabilities: {
        cloud_enabled: false,
        dev_space_enabled: true,
        byok_enabled: true,
        allowed_model_keys: [],
        monthly_generation_limit: null,
        trial_request_limit: null,
        device_limit: input.maxDevices,
      },
    };
  }

  return {
    tier: "pro",
    capabilities: {
      cloud_enabled: true,
      dev_space_enabled: true,
      byok_enabled: true,
      allowed_model_keys: [
        "auto",
        "fast",
        "premium",
        "vision",
        "code",
        "audio",
        "audio-auto",
      ],
      monthly_generation_limit: normalizedPlan === "pro-monthly" ? 1500 : null,
      trial_request_limit: null,
      device_limit: input.maxDevices,
    },
  };
}

function isLimitedTrialPlanCode(planCode: string | null | undefined): boolean {
  return (planCode ?? "").trim().toLowerCase() === "limited-trial";
}

function isLimitedTrialLicense(license: {
  entitlement?: { plan?: { planCode: string } | null } | null;
}): boolean {
  return isLimitedTrialPlanCode(license.entitlement?.plan?.planCode);
}

function generateLicenseKey() {
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `RIEKO-${part()}-${part()}-${part()}-${part()}`;
}

async function enforceLimitedTrialActivationPolicy(
  tx: Prisma.TransactionClient,
  license: NonNullable<Awaited<ReturnType<typeof findLicenseForRuntime>>>,
  input: ActivateLicenseInput,
): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  if (!isLimitedTrialLicense(license)) {
    return { ok: true };
  }

  const customer = license.entitlement?.customer;

  if (!customer) {
    return {
      ok: false,
      error: "TRIAL_CONTEXT_MISSING",
      message: "Limited trial activation context is incomplete.",
    };
  }

  const historicalActivationOnDifferentMachine = license.activations.find(
    (activation) => activation.machineId !== input.machineId,
  );

  if (historicalActivationOnDifferentMachine) {
    return {
      ok: false,
      error: "TRIAL_LICENSE_LOCKED_TO_MACHINE",
      message:
        "This limited trial license is already locked to a different machine.",
    };
  }

  if (license.trialRedemption) {
    if (license.trialRedemption.machineId !== input.machineId) {
      return {
        ok: false,
        error: "TRIAL_LICENSE_LOCKED_TO_MACHINE",
        message:
          "This limited trial license is already locked to a different machine.",
      };
    }

    return { ok: true };
  }

  const existingMachineRedemption = await tx.trialRedemption.findUnique({
    where: { machineId: input.machineId },
    select: { licenseId: true },
  });

  if (
    existingMachineRedemption &&
    existingMachineRedemption.licenseId !== license.id
  ) {
    return {
      ok: false,
      error: "TRIAL_MACHINE_ALREADY_USED",
      message:
        "This machine has already redeemed a limited trial and cannot redeem another one.",
    };
  }

  const existingCustomerRedemption = await tx.trialRedemption.findUnique({
    where: { customerId: customer.id },
    select: { licenseId: true },
  });

  if (
    existingCustomerRedemption &&
    existingCustomerRedemption.licenseId !== license.id
  ) {
    return {
      ok: false,
      error: "TRIAL_CUSTOMER_ALREADY_USED",
      message: "This customer has already redeemed the limited trial.",
    };
  }

  await tx.trialRedemption.create({
    data: {
      licenseId: license.id,
      customerId: customer.id,
      customerEmail: customer.email,
      machineId: input.machineId,
      instanceId: input.instanceId,
    },
  });

  return { ok: true };
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

export async function activateLicense(
  input: ActivateLicenseInput,
): Promise<ActivateLicenseResult> {
  const licenseKey = normalizeLicenseKey(input.licenseKey);
  const license = await findLicenseForRuntime(licenseKey);

  if (!license) {
    return {
      activated: false,
      error: "LICENSE_NOT_FOUND",
      message: "License was not found.",
      is_dev_license: false,
    };
  }

  const eligibility = isLicenseRuntimeEligible(license);
  if (!eligibility.ok) {
    return {
      activated: false,
      error: eligibility.reason,
      message: eligibility.message,
      is_dev_license: license.isAdmin,
    };
  }

  if (isLimitedTrialLicense(license)) {
    const trialPolicy = await prisma.$transaction((tx) =>
      enforceLimitedTrialActivationPolicy(tx, license, input),
    );

    if (!trialPolicy.ok) {
      return {
        activated: false,
        error: trialPolicy.error,
        message: trialPolicy.message,
        is_dev_license: license.isAdmin,
      };
    }
  }

  const existingActivation = findMatchingActivation(
    license.activations,
    input.machineId,
    input.instanceId,
  );

  if (existingActivation && existingActivation.status === ActivationStatus.ACTIVE) {
    return {
      activated: true,
      license_key: license.licenseKey,
      instance: {
        id: existingActivation.instanceId,
        name: existingActivation.instanceId,
        created_at: existingActivation.activatedAt.toISOString(),
      },
      is_dev_license: license.isAdmin,
    };
  }

  if (existingActivation && existingActivation.status === ActivationStatus.INACTIVE) {
    const reactivated = await prisma.licenseActivation.update({
      where: { id: existingActivation.id },
      data: {
        status: ActivationStatus.ACTIVE,
        deactivatedAt: null,
        appVersion: input.appVersion ?? undefined,
      },
    });

    return {
      activated: true,
      license_key: license.licenseKey,
      instance: {
        id: reactivated.instanceId,
        name: reactivated.instanceId,
        created_at: reactivated.activatedAt.toISOString(),
      },
      is_dev_license: license.isAdmin,
    };
  }

  const activeCount = countActiveActivations(license.activations);

  if (activeCount >= license.maxDevices) {
    return {
      activated: false,
      error: "DEVICE_LIMIT_REACHED",
      message: "This license has reached its device limit.",
      is_dev_license: license.isAdmin,
    };
  }

  const created = await prisma.licenseActivation.create({
    data: {
      licenseId: license.id,
      machineId: input.machineId,
      instanceId: input.instanceId,
      appVersion: input.appVersion ?? null,
      status: ActivationStatus.ACTIVE,
      lastValidatedAt: new Date(),
    },
  });

  return {
    activated: true,
    license_key: license.licenseKey,
    instance: {
      id: created.instanceId,
      name: created.instanceId,
      created_at: created.activatedAt.toISOString(),
    },
    is_dev_license: license.isAdmin,
  };
}

export async function validateLicense(
  input: ValidateLicenseInput,
): Promise<ValidateLicenseResult> {
  const adminDevice = await prisma.adminDevice.findUnique({
    where: { machineId: input.machineId },
  });

  if (adminDevice?.active) {
    const runtime = buildRuntimeCapabilities({
      planCode: "admin",
      maxDevices: 99,
      isAdmin: true,
    });

    return {
      is_active: true,
      last_validated_at: new Date().toISOString(),
      is_dev_license: true,
      plan_code: "admin",
      tier: runtime.tier,
      capabilities: runtime.capabilities,
    };
  }

  const licenseKey = normalizeLicenseKey(input.licenseKey);
  const license = await findLicenseForRuntime(licenseKey);

  if (!license) {
    return {
      is_active: false,
      last_validated_at: null,
      is_dev_license: false,
      reason: "LICENSE_NOT_FOUND",
      plan_code: null,
      tier: null,
      capabilities: null,
    };
  }

  const runtime = buildRuntimeCapabilities({
    planCode: license.entitlement?.plan?.planCode ?? null,
    maxDevices: license.maxDevices,
    isAdmin: license.isAdmin,
  });

  const eligibility = isLicenseRuntimeEligible(license);
  if (!eligibility.ok) {
    return {
      is_active: false,
      last_validated_at: null,
      is_dev_license: license.isAdmin,
      reason: eligibility.reason,
      plan_code: license.entitlement?.plan?.planCode ?? null,
      tier: runtime.tier,
      capabilities: runtime.capabilities,
    };
  }

  if (
    isLimitedTrialLicense(license) &&
    license.trialRedemption &&
    license.trialRedemption.machineId !== input.machineId
  ) {
    return {
      is_active: false,
      last_validated_at: null,
      is_dev_license: license.isAdmin,
      reason: "TRIAL_MACHINE_MISMATCH",
      plan_code: license.entitlement?.plan?.planCode ?? null,
      tier: runtime.tier,
      capabilities: runtime.capabilities,
    };
  }

  const activation = license.activations.find(
    (item) =>
      item.machineId === input.machineId &&
      item.instanceId === input.instanceId &&
      item.status === ActivationStatus.ACTIVE,
  );

  if (!activation) {
    return {
      is_active: false,
      last_validated_at: null,
      is_dev_license: license.isAdmin,
      reason: "ACTIVATION_NOT_FOUND",
      plan_code: license.entitlement?.plan?.planCode ?? null,
      tier: runtime.tier,
      capabilities: runtime.capabilities,
    };
  }

  const updated = await prisma.licenseActivation.update({
    where: { id: activation.id },
    data: {
      lastValidatedAt: new Date(),
      appVersion: input.appVersion ?? activation.appVersion ?? null,
    },
  });

  if (isLimitedTrialLicense(license) && license.trialRedemption) {
    await prisma.trialRedemption.update({
      where: { licenseId: license.id },
      data: {
        lastValidatedAt: new Date(),
      },
    });
  }

  return {
    is_active: true,
    last_validated_at: updated.lastValidatedAt?.toISOString() ?? null,
    is_dev_license: license.isAdmin,
    plan_code: license.entitlement?.plan?.planCode ?? null,
    tier: runtime.tier,
    capabilities: runtime.capabilities,
  };
}

export async function deactivateLicense(
  input: DeactivateLicenseInput,
): Promise<DeactivateLicenseResult> {
  const licenseKey = normalizeLicenseKey(input.licenseKey);
  const license = await prisma.license.findUnique({
    where: { licenseKey },
    include: {
      activations: true,
    },
  });

  if (!license) {
    return {
      deactivated: true,
      license_key: licenseKey,
      instance: {
        id: input.instanceId,
        name: input.instanceId,
      },
      is_dev_license: false,
    };
  }

  const activation = findMatchingActivation(
    license.activations,
    input.machineId,
    input.instanceId,
  );

  if (activation && activation.status === ActivationStatus.ACTIVE) {
    await prisma.licenseActivation.update({
      where: { id: activation.id },
      data: {
        status: ActivationStatus.INACTIVE,
        deactivatedAt: new Date(),
      },
    });
  }

  return {
    deactivated: true,
    license_key: license.licenseKey,
    instance: {
      id: input.instanceId,
      name: input.instanceId,
    },
    is_dev_license: license.isAdmin,
  };
}
