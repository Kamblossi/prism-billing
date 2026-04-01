import { Router } from "express";
import { z } from "zod";
import { getPaymentVerificationStatus } from "../../modules/payments/payments.service.js";

const router = Router();

const verifyQuerySchema = z.object({
  reference: z.string().trim().min(1),
});

router.get("/pay/verify", async (req, res, next) => {
  try {
    const parsed = verifyQuerySchema.parse(req.query);
    const result = await getPaymentVerificationStatus(parsed.reference);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
