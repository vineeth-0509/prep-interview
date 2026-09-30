import { Router } from "express";
import { authRouter } from "./authRoutes";
import { kitRouter } from "./kitRoutes";

export const router = Router();

router.use("/auth", authRouter);
router.use("/kits", kitRouter);
