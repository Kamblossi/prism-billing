import { prisma } from "../../db/prisma.js";
import {
  EntitlementType,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
} from "@prisma/client";
import { createLicenseEntitlement } from "../entitlements/entitlements.service.js";
import { issueLicenseForEntitlement } from "../licenses/licenses.service.js";
import { verifyPaystackTransaction } from "../providers/paystack/paystack.service.js";

export async function processSuccessfulPayment(reference: string) {
  const paymentAttempt = await prisma.paymentAttempt.findUnique({
    where: {
      provider_providerReference: {
        provider: PaymentProvider.PAYSTACK,
        providerReference: reference,
      },
    },
    include: {
      order: {
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              plan: true,
            },
          },
          entitlements: {
            include: {
              license: true,
            },
          },
        },
      },
    },
  });

  if (!paymentAttempt) {
    throw new Error(`Payment attempt not found for reference: ${reference}`);
  }

  const order = paymentAttempt.order;
  const orderItem = order.items[0];

  if (!orderItem) {
    throw new Error(`Order ${order.id} has no order items`);
  }

  const existingEntitlement = order.entitlements.find(
    (entitlement) =>
      entitlement.productId === orderItem.productId &&
      entitlement.planId === orderItem.planId &&
      entitlement.entitlementType === EntitlementType.LICENSE,
  );

  if (existingEntitlement?.license) {
    return {
      reference,
      paymentStatus: paymentAttempt.status,
      orderStatus: order.status,
      fulfilled: true,
      entitlement: existingEntitlement,
      license: existingEntitlement.license,
    };
  }

  const verified = await verifyPaystackTransaction(reference);

  if (verified.status !== "success") {
    throw new Error(
      `Paystack verification returned non-success status: ${verified.status}`,
    );
  }

  if (verified.reference !== reference) {
    throw new Error("Verified transaction reference mismatch");
  }

  if (
    verified.amount !== paymentAttempt.amountMinor ||
    verified.currency.toUpperCase() !== paymentAttempt.currency.toUpperCase()
  ) {
    throw new Error("Verified transaction amount or currency mismatch");
  }

  return prisma.$transaction(async (tx) => {
    await tx.paymentAttempt.update({
      where: {
        provider_providerReference: {
          provider: PaymentProvider.PAYSTACK,
          providerReference: reference,
        },
      },
      data: {
        status: PaymentAttemptStatus.SUCCEEDED,
        completedAt: verified.paidAt ? new Date(verified.paidAt) : new Date(),
      },
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
      },
    });

    const createdEntitlement = existingEntitlement
      ? null
      : await createLicenseEntitlement(tx, {
        customerId: order.customerId,
        orderId: order.id,
        appId: order.appId,
        productId: orderItem.productId,
        planId: orderItem.planId,
        accessPeriodUnit: orderItem.plan.accessPeriodUnit,
        accessPeriodCount: orderItem.plan.accessPeriodCount,
      });

    const entitlementId = existingEntitlement?.id ?? createdEntitlement?.id;

    if (!entitlementId) {
      throw new Error("Failed to resolve entitlement for successful payment");
    }

    const license = await issueLicenseForEntitlement(tx, {
      entitlementId,
      maxDevices: orderItem.plan.maxDevices,
      isAdmin: false,
    });

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.FULFILLED,
      },
    });

    return {
      reference,
      paymentStatus: PaymentAttemptStatus.SUCCEEDED,
      orderStatus: OrderStatus.FULFILLED,
      fulfilled: true,
      entitlement: existingEntitlement ?? createdEntitlement,
      license,
    };
  });
}

export async function getPaymentVerificationStatus(reference: string) {
  const paymentAttempt = await prisma.paymentAttempt.findUnique({
    where: {
      provider_providerReference: {
        provider: PaymentProvider.PAYSTACK,
        providerReference: reference,
      },
    },
    include: {
      order: {
        include: {
          entitlements: {
            include: {
              license: true,
            },
          },
        },
      },
    },
  });

  if (!paymentAttempt) {
    throw new Error(`Payment attempt not found for reference: ${reference}`);
  }

  const entitlement = paymentAttempt.order.entitlements.find(
    (item) => item.entitlementType === EntitlementType.LICENSE,
  );

  return {
    reference,
    paymentStatus: paymentAttempt.status,
    orderStatus: paymentAttempt.order.status,
    fulfilled: Boolean(entitlement?.license),
    entitlement: entitlement
      ? {
          status: entitlement.status,
          startsAt: entitlement.startsAt,
          expiresAt: entitlement.expiresAt,
        }
      : null,
    license: entitlement?.license
      ? {
          licenseKey: entitlement.license.licenseKey,
          maxDevices: entitlement.license.maxDevices,
          status: entitlement.license.status,
        }
      : null,
  };
}