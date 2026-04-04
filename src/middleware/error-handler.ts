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
    const errorWithMeta = error as Error & {
      statusCode?: unknown;
      code?: unknown;
    };

    const statusCode =
      typeof errorWithMeta.statusCode === "number"
        ? errorWithMeta.statusCode
        : null;
    const errorCode =
      typeof errorWithMeta.code === "string"
        ? errorWithMeta.code
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
