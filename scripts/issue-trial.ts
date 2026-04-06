// prism-billing/scripts/issue-trial.ts
import "dotenv/config";
import { OrderSource, OrderStatus, PrismaClient } from "../src/generated/prisma/index.js";
import { issueLicenseForEntitlement } from "../src/modules/licenses/licenses.service.js";
import { createLicenseEntitlement } from "../src/modules/entitlements/entitlements.service.js";

const prisma = new PrismaClient();

async function main() {
  // 1. Find the Trial Plan seeded earlier
  const plan = await prisma.plan.findFirst({
    where: { planCode: "limited-trial", active: true }
  });

  if (!plan) {
    console.error("Error: 'limited-trial' plan not found. Run 'npm run prisma:seed' first.");
    process.exit(1);
  }

  // 2. Create/Find a test customer
  const customer = await prisma.customer.upsert({
    where: { email: "tester@prismtechco.com" },
    update: {},
    create: { email: "tester@prismtechco.com", name: "RC-1 Test Account" }
  });

  // 3. Create an admin Order record (required FK for the entitlement)
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      appId: "rieko",
      source: OrderSource.ADMIN,
      status: OrderStatus.FULFILLED,
    }
  });

  // 4. Create the Entitlement (The 'Right to Use')
  const entitlement = await createLicenseEntitlement(prisma, {
    customerId: customer.id,
    orderId: order.id,
    appId: "rieko",
    productId: plan.productId,
    planId: plan.id,
    accessPeriodUnit: plan.accessPeriodUnit,
    accessPeriodCount: plan.accessPeriodCount,
  });

  // 4. Issue the actual License Key
  const license = await issueLicenseForEntitlement(prisma, {
    entitlementId: entitlement.id,
    maxDevices: plan.maxDevices,
  });

  console.log("\n==========================================");
  console.log("   FRESH TRIAL LICENSE CREATED");
  console.log("==========================================");
  console.log(`LICENSE KEY: ${license.licenseKey}`);
  console.log("==========================================\n");
}

main().catch(console.error).finally(() => prisma.$disconnect());
