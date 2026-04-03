import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "ValidationError",
      issues: error.issues,
    });
  }

  if (error instanceof Error) {
    const statusCode =
      typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null;
    const errorCode =
      typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : null;

    if (statusCode) {
      return res.status(statusCode).json({
        error: errorCode ?? "RequestError",
        message: error.message,
      });
    }

    const message = error.message;
    const normalized = message.toLowerCase();

    if (normalized.includes("not found") || normalized.includes("inactive")) {
      return res.status(404).json({
        error: "NotFound",
        message,
      });
    }

    return res.status(500).json({
      error: "InternalServerError",
      message,
    });
  }

  return res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected error occurred",
  });
}
