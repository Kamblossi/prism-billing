/*
  Warnings:

  - A unique constraint covering the columns `[order_id,product_id,plan_id,entitlement_type]` on the table `entitlements` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[order_id,product_id,plan_id]` on the table `order_items` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "entitlements_order_id_product_id_plan_id_entitlement_type_key" ON "entitlements"("order_id", "product_id", "plan_id", "entitlement_type");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_product_id_plan_id_key" ON "order_items"("order_id", "product_id", "plan_id");
