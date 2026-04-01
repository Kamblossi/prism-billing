import { Router } from "express";
import { z } from "zod";
import {
  getDesktopCheckoutRedirect,
  initializeCheckout,
  listCatalogPlans,
} from "../../modules/checkout/checkout.service.js";

const router = Router();

const listPlansQuerySchema = z.object({
  appId: z.string().trim().min(1).default("rieko"),
  productCode: z.string().trim().min(1).default("rieko-desktop"),
});

const checkoutInitSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1),
  appId: z.string().trim().min(1),
  productCode: z.string().trim().min(1),
  planCode: z.string().trim().min(1),
});

router.get("/catalog/plans", async (req, res, next) => {
  try {
    const parsed = listPlansQuerySchema.parse(req.query);

    const result = await listCatalogPlans(parsed.appId, parsed.productCode);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/web/checkout/init", async (req, res, next) => {
  try {
    const parsed = checkoutInitSchema.parse(req.body);

    const result = await initializeCheckout(parsed);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/checkout", async (_req, res, next) => {
  try {
    const result = getDesktopCheckoutRedirect();

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
