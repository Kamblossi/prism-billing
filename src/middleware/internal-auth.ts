import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

export function requireInternalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing Bearer token",
    });
  }

  if (token !== env.INTERNAL_API_ACCESS_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid internal API token",
    });
  }

  next();
}

export function requireDesktopBillingAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing Bearer token",
    });
  }

  if (token !== env.DESKTOP_BILLING_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid desktop billing token",
    });
  }

  next();
}

export function requireDesktopOrInternalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing Bearer token",
    });
  }

  if (
    token !== env.DESKTOP_BILLING_KEY &&
    token !== env.INTERNAL_API_ACCESS_KEY
  ) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid service token",
    });
  }

  next();
}
