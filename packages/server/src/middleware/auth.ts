import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";

export const COOKIE_NAME = "aipk_session";

/**
 * Requires a valid session. On a missing, expired, or otherwise invalid
 * token this throws a 401 AppError rather than letting the request fall
 * through — §5: "expired/invalid session -> 401 -> frontend redirects to
 * login, does not crash or show stale state." The frontend distinguishes
 * this from other 4xxs purely by status code, so no extra payload shape
 * is needed here beyond the standard {code, message} error body.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return next(new AppError("UNAUTHENTICATED", "Not signed in.", 401));
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub };
    next();
  } catch {
    next(new AppError("SESSION_EXPIRED", "Session expired or invalid.", 401));
  }
}
