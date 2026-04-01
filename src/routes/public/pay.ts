import { Router } from "express";

const router = Router();

router.get("/pay/verify", async (_req, res) => {
  res.status(501).json({
    message: "Payment verification endpoint not implemented yet",
  });
});

export default router;
