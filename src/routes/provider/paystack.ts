import { Router } from "express";

const router = Router();

router.post("/providers/paystack/webhook", async (_req, res) => {
  res.status(501).json({
    message: "Paystack webhook handler not implemented yet",
  });
});

export default router;
