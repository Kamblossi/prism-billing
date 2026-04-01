import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function requireInternalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing Bearer token",
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (token !== env.INTERNAL_API_ACCESS_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid internal API token",
    });
  }

  next();
}
