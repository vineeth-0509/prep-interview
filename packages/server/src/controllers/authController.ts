import bcrypt from "bcrypt";
import type { Request, Response } from "express";
import { z } from "zod";
import { User } from "../models/User";
import { signToken } from "../utils/jwt";
import { AppError } from "../utils/AppError";
import { COOKIE_NAME } from "../middleware/auth";
import { sessionCookieOptions } from "../utils/cookies";

const BCRYPT_ROUNDS = 12;

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function register(req: Request, res: Response) {
  const { email, password } = CredentialsSchema.parse(req.body);

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError("EMAIL_TAKEN", "An account with that email already exists.", 409);
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await User.create({ email, password_hash });

  const token = signToken(user._id.toString());
  res.cookie(COOKIE_NAME, token, sessionCookieOptions());
  res.status(201).json({ id: user._id, email: user.email });
}

export async function login(req: Request, res: Response) {
  const { email, password } = CredentialsSchema.parse(req.body);

  const user = await User.findOne({ email });
  // Same error for "no such user" and "wrong password" — don't leak
  // which one it was.
  const invalid = () =>
    new AppError("INVALID_CREDENTIALS", "Incorrect email or password.", 401);

  if (!user) throw invalid();
  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) throw invalid();

  const token = signToken(user._id.toString());
  res.cookie(COOKIE_NAME, token, sessionCookieOptions());
  res.status(200).json({ id: user._id, email: user.email });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, sessionCookieOptions());
  res.status(204).send();
}

export async function me(req: Request, res: Response) {
  // requireAuth has already validated the session by the time this runs.
  const user = await User.findById(req.user!.id).select("email");
  if (!user) {
    throw new AppError("UNAUTHENTICATED", "Not signed in.", 401);
  }
  res.status(200).json({ id: user._id, email: user.email });
}
