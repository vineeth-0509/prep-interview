import type { CookieOptions } from "express";
import { env } from "../config/env";

/**
 * Frontend and backend are deployed to different origins (e.g. Vercel +
 * Render), so the cookie must be sendable cross-site in production —
 * that requires `sameSite: "none"` paired with `secure: true`. Locally,
 * `lax` + non-secure keeps http://localhost development simple without
 * needing a local TLS cert.
 */
export function sessionCookieOptions(): CookieOptions {
  const isProd = env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}
