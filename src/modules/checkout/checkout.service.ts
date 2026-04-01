import {
  OrderSource,
  OrderStatus,
  PaymentAttemptStatus,
  PaymentProvider,
} from "../../generated/prisma/enums.js";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { generateProviderReference, normalizeEmail } from "../../utils/ids.js";
import { initializePaystackTransaction } from "../providers/paystack/paystack.service.js";

export type CatalogPlansResponse = {
  product: {
    appId: string;
    productCode: string;
    name: string;
  };
  plans: Array<{
    planCode: string;
    name: string;
    billingType: string;
    amountMinor: number;
    currency: string;
    accessPeriodUnit: string;
    accessPeriodCount: number;
    maxDevices: number;
  }>;
};

export type InitializeCheckoutInput = {
  email: string;
  name: string;
  appId: string;
  productCode: string;
  planCode: string;
};

export type InitializeCheckoutResult = {
  checkoutUrl: string;
  reference: string;
};

export async function listCatalogPlans(
  appId: string,
  productCode: string,
): Promise<CatalogPlansResponse> {
  const product = await prisma.product.findFirst({
    where: {
      appId,
      productCode,
      active: true,
    },
    include: {
      plans: {
        where: { active: true },
        orderBy: [{ amountMinor: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!product) {
    throw new Error("Product not found or inactive");
  }

  return {
    product: {
      appId: product.appId,
      productCode: product.productCode,
      name: product.name,
    },
    plans: product.plans.map((plan) => ({
      planCode: plan.planCode,
      name: plan.name,
      billingType: plan.billingType,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
      accessPeriodUnit: plan.accessPeriodUnit,
      accessPeriodCount: plan.accessPeriodCount,
      maxDevices: plan.maxDevices,
    })),
  };
}

export async function initializeCheckout(
  input: InitializeCheckoutInput,
): Promise<InitializeCheckoutResult> {
  const email = normalizeEmail(input.email);

  const product = await prisma.product.findUnique({
    where: {
      appId_productCode: {
        appId: input.appId,
        productCode: input.productCode,
      },
    },
  });

  if (!product || !product.active) {
    throw new Error("Product not found or inactive");
  }

  const plan = await prisma.plan.findUnique({
    where: {
      productId_planCode: {
        productId: product.id,
        planCode: input.planCode,
      },
    },
  });

  if (!plan || !plan.active) {
    throw new Error("Plan not found or inactive");
  }

  const reference = generateProviderReference(product.appId);

  const persisted = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.upsert({
      where: { email },
      update: {
        name: input.name?.trim() || undefined,
      },
      create: {
        email,
        name: input.name?.trim() || null,
      },
    });

    const order = await tx.order.create({
      data: {
        customerId: customer.id,
        status: OrderStatus.PAYMENT_PENDING,
        source: OrderSource.WEB,
        appId: product.appId,
      },
    });

    await tx.orderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        planId: plan.id,
        quantity: 1,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
      },
    });

    const paymentAttempt = await tx.paymentAttempt.create({
      data: {
        orderId: order.id,
        provider: PaymentProvider.PAYSTACK,
        providerReference: reference,
        status: PaymentAttemptStatus.INITIALIZED,
        amountMinor: plan.amountMinor,
        currency: plan.currency,
      },
    });

    return {
      customer,
      order,
      paymentAttempt,
      plan,
      product,
    };
  });

  try {
    const paystack = await initializePaystackTransaction({
      email,
      amountMinor: persisted.plan.amountMinor,
      currency: persisted.plan.currency,
      reference,
      callbackUrl: env.PAYSTACK_CALLBACK_URL,
      metadata: {
        appId: persisted.product.appId,
        productCode: persisted.product.productCode,
        planCode: persisted.plan.planCode,
        source: "WEB",
        customerEmail: email,
        orderId: persisted.order.id,
      },
    });

    await prisma.paymentAttempt.update({
      where: {
        provider_providerReference: {
          provider: PaymentProvider.PAYSTACK,
          providerReference: reference,
        },
      },
      data: {
        checkoutUrl: paystack.authorizationUrl,
        status: PaymentAttemptStatus.PENDING,
      },
    });

    return {
      checkoutUrl: paystack.authorizationUrl,
      reference: paystack.reference,
    };
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.paymentAttempt.update({
        where: {
          provider_providerReference: {
            provider: PaymentProvider.PAYSTACK,
            providerReference: reference,
          },
        },
        data: {
          status: PaymentAttemptStatus.FAILED,
        },
      });

      await tx.order.update({
        where: { id: persisted.order.id },
        data: {
          status: OrderStatus.FAILED,
        },
      });
    });

    throw error;
  }
}

export function getDesktopCheckoutRedirect() {
  return {
    success: true,
    checkout_url: env.DESKTOP_PRICING_URL,
  };
}
