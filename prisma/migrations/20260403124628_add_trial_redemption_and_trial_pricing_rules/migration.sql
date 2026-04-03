-- CreateTable
CREATE TABLE "trial_redemptions" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "redeemed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_validated_at" TIMESTAMP(3),

    CONSTRAINT "trial_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trial_redemptions_license_id_key" ON "trial_redemptions"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "trial_redemptions_customer_id_key" ON "trial_redemptions"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "trial_redemptions_machine_id_key" ON "trial_redemptions"("machine_id");

-- CreateIndex
CREATE INDEX "trial_redemptions_customer_email_idx" ON "trial_redemptions"("customer_email");

-- AddForeignKey
ALTER TABLE "trial_redemptions" ADD CONSTRAINT "trial_redemptions_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_redemptions" ADD CONSTRAINT "trial_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
