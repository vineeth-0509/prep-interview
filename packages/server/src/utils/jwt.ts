import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface JwtPayload {
  sub: string; // user id
}

const TOKEN_TTL = "7d";

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId } satisfies JwtPayload, env.JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token: string): JwtPayload {
  // Throws on expiry/invalid signature/malformed token — callers treat
  // any throw as "not authenticated", per §5's 401-on-invalid-session rule.
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
