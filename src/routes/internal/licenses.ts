import { Router } from "express";
import { requireInternalAuth } from "../../middleware/internal-auth.js";

const router = Router();

router.use(requireInternalAuth);

router.post("/licenses/activate", async (_req, res) => {
  res.status(501).json({
    message: "License activation not implemented yet",
  });
});

router.post("/licenses/validate", async (_req, res) => {
  res.status(501).json({
    message: "License validation not implemented yet",
  });
});

router.post("/licenses/deactivate", async (_req, res) => {
  res.status(501).json({
    message: "License deactivation not implemented yet",
  });
});

export default router;
