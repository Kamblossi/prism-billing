import type { NextFunction, Request, Response } from "express";

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(error);

  if (error instanceof Error) {
    return res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
    });
  }

  return res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
}
