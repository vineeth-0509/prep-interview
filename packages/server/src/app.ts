import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { router } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true, // required for the httpOnly session cookie to be sent
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

  app.use("/api", router);

  // Must be registered last: Express only routes to an error handler
  // that comes after the routes it's guarding.
  app.use(errorHandler);

  return app;
}
