import { Router } from "express";

const router = Router();

router.get("/catalog/plans", async (_req, res) => {
  res.status(501).json({
    message: "Catalog lookup not implemented yet",
  });
});

router.post("/web/checkout/init", async (_req, res) => {
  res.status(501).json({
    message: "Checkout initialization not implemented yet",
  });
});

router.post("/checkout", async (_req, res) => {
  res.status(501).json({
    message: "Desktop checkout URL endpoint not implemented yet",
  });
});

export default router;
