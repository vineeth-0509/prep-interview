import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";
import { env } from "../config/env";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      code: err.code,
      message: err.message,
      ...(err.step ? { step: err.step } : {}),
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    });
  }

  // Unknown/unexpected error: log the real detail server-side, never leak
  // a stack trace to the client.
  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({
    code: "INTERNAL_ERROR",
    message:
      env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Something went wrong.",
  });
}
