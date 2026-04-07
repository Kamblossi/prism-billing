import { Router } from "express";
import { z } from "zod";
import { requireDesktopBillingAuth } from "../../middleware/internal-auth.js";
import {
  activateLicense,
  deactivateLicense,
  validateLicense,
} from "../../modules/licenses/licenses.service.js";

const router = Router();

router.use(requireDesktopBillingAuth);

const runtimeBodySchema = z.object({
  license_key: z.string().trim().min(1),
  machine_id: z.string().trim().min(1),
  instance_name: z.string().trim().min(1),
  app_version: z.string().trim().min(1).optional(),
});

const deactivateBodySchema = z.object({
  license_key: z.string().trim().min(1),
  machine_id: z.string().trim().min(1),
  instance_name: z.string().trim().min(1),
});

router.post("/licenses/activate", async (req, res, next) => {
  try {
    const parsed = runtimeBodySchema.parse(req.body);
    const result = await activateLicense({
      licenseKey: parsed.license_key,
      machineId: parsed.machine_id,
      instanceId: parsed.instance_name,
      appVersion: parsed.app_version,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/licenses/validate", async (req, res, next) => {
  try {
    const parsed = runtimeBodySchema.parse(req.body);
    const result = await validateLicense({
      licenseKey: parsed.license_key,
      machineId: parsed.machine_id,
      instanceId: parsed.instance_name,
      appVersion: parsed.app_version,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/licenses/deactivate", async (req, res, next) => {
  try {
    const parsed = deactivateBodySchema.parse(req.body);
    const result = await deactivateLicense({
      licenseKey: parsed.license_key,
      machineId: parsed.machine_id,
      instanceId: parsed.instance_name,
    });

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
