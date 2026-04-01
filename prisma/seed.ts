import "dotenv/config";
import {
  AccessPeriodUnit,
  BillingType,
  PrismaClient,
} from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
});

const PRODUCT = {
  appId: "rieko",
  productCode: "rieko-desktop",
  name: "Rieko Desktop",
  description: "Rieko desktop AI assistant by PrismTechCo",
  active: true,
};

const PLANS = [
  {
    planCode: "pro-monthly",
    name: "Pro Monthly",
    billingType: BillingType.ONE_TIME,
    amountMinor: 520000,
    currency: "KES",
    accessPeriodUnit: AccessPeriodUnit.MONTH,
    accessPeriodCount: 1,
    maxDevices: 1,
    active: true,
  },
  {
    planCode: "pro-yearly",
    name: "Pro Yearly",
    billingType: BillingType.ONE_TIME,
    amountMinor: 4667400,
    currency: "KES",
    accessPeriodUnit: AccessPeriodUnit.YEAR,
    accessPeriodCount: 1,
    maxDevices: 2,
    active: true,
  },
] as const;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const product = await tx.product.upsert({
      where: {
        appId_productCode: {
          appId: PRODUCT.appId,
          productCode: PRODUCT.productCode,
        },
      },
      update: {
        name: PRODUCT.name,
        description: PRODUCT.description,
        active: PRODUCT.active,
      },
      create: {
        appId: PRODUCT.appId,
        productCode: PRODUCT.productCode,
        name: PRODUCT.name,
        description: PRODUCT.description,
        active: PRODUCT.active,
      },
    });

    const plans = [];

    for (const planInput of PLANS) {
      const plan = await tx.plan.upsert({
        where: {
          productId_planCode: {
            productId: product.id,
            planCode: planInput.planCode,
          },
        },
        update: {
          name: planInput.name,
          billingType: planInput.billingType,
          amountMinor: planInput.amountMinor,
          currency: planInput.currency,
          accessPeriodUnit: planInput.accessPeriodUnit,
          accessPeriodCount: planInput.accessPeriodCount,
          maxDevices: planInput.maxDevices,
          active: planInput.active,
        },
        create: {
          productId: product.id,
          planCode: planInput.planCode,
          name: planInput.name,
          billingType: planInput.billingType,
          amountMinor: planInput.amountMinor,
          currency: planInput.currency,
          accessPeriodUnit: planInput.accessPeriodUnit,
          accessPeriodCount: planInput.accessPeriodCount,
          maxDevices: planInput.maxDevices,
          active: planInput.active,
        },
      });

      plans.push(plan);
    }

    return { product, plans };
  });

  console.log("Seed complete");
  console.log({
    productId: result.product.id,
    appId: result.product.appId,
    productCode: result.product.productCode,
    plans: result.plans.map((plan) => ({
      planId: plan.id,
      planCode: plan.planCode,
      billingType: plan.billingType,
      currency: plan.currency,
      amountMinor: plan.amountMinor,
      accessPeriodUnit: plan.accessPeriodUnit,
      accessPeriodCount: plan.accessPeriodCount,
      maxDevices: plan.maxDevices,
    })),
  });
}

main()
  .catch((error) => {
    console.error("Seed failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
