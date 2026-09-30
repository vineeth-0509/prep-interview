import { Router } from "express";
import {
  createKit,
  deleteKit,
  getKit,
  listKits,
  regenerateKitSection,
  updateKit,
} from "../controllers/kitController";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";

export const kitRouter = Router();

kitRouter.use(requireAuth);

kitRouter.post("/", asyncHandler(createKit));
kitRouter.get("/", asyncHandler(listKits));
kitRouter.get("/:id", asyncHandler(getKit));
kitRouter.patch("/:id", asyncHandler(updateKit));
kitRouter.delete("/:id", asyncHandler(deleteKit));
kitRouter.post("/:id/regenerate", asyncHandler(regenerateKitSection));
