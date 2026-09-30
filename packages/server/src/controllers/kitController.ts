import type { Request, Response } from "express";
import { z } from "zod";
import { computeContentHash, validateKit, regenerateSection, type RegenerateScope, type Kit as CoreKit } from "@aipk/core";
import { Kit } from "../models/Kit";
import { AppError } from "../utils/AppError";
import { runAndPersistPipeline } from "../services/pipelineRunner";
import { env } from "../config/env";

const CreateKitSchema = z.object({
  jd_text: z.string().min(1, "Job description text is required"),
  company_url: z.string().url("Company URL must be a valid URL"),
  days: z.number().int().min(1).max(60),
});

async function findOwnedKitOr404(id: string, ownerId: string) {
  const doc = await Kit.findOne({ _id: id, owner_id: ownerId });
  if (!doc) {
    throw new AppError("KIT_NOT_FOUND", "Kit not found.", 404);
  }
  return doc;
}

export async function createKit(req: Request, res: Response) {
  const { jd_text, company_url, days } = CreateKitSchema.parse(req.body);
  const content_hash = computeContentHash(jd_text, company_url);

  // §9/§10: the same JD + company submitted twice shouldn't silently
  // re-run the full pipeline and burn LLM/search quota a second time.
  const existing = await Kit.findOne({
    owner_id: req.user!.id,
    content_hash,
    pipeline_status: { $in: ["completed", "running"] },
  });
  if (existing) {
    return res.status(200).json({ id: existing._id, deduped: true, pipeline_status: existing.pipeline_status });
  }

  const doc = await Kit.create({
    owner_id: req.user!.id,
    jd_text,
    company_url,
    days_requested: days,
    content_hash,
    pipeline_status: "running",
  });

  // Fire-and-forget: the HTTP response doesn't wait for a generation that
  // can take up to ~90 seconds (§13). The client polls GET /api/kits/:id.
  runAndPersistPipeline(doc._id.toString()).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Unhandled pipeline error:", err);
  });

  res.status(202).json({ id: doc._id, deduped: false, pipeline_status: "running" });
}

export async function listKits(req: Request, res: Response) {
  const docs = await Kit.find({ owner_id: req.user!.id })
    .select("company_url days_requested pipeline_status current_step createdAt updatedAt kit.source")
    .sort({ createdAt: -1 })
    .lean();
  res.status(200).json(docs);
}

export async function getKit(req: Request, res: Response) {
  const doc = await findOwnedKitOr404(req.params.id, req.user!.id);
  res.status(200).json(doc);
}

export async function deleteKit(req: Request, res: Response) {
  const doc = await findOwnedKitOr404(req.params.id, req.user!.id);
  await doc.deleteOne();
  res.status(204).send();
}

const UpdateKitSchema = z.object({
  kit: z.record(z.unknown()), // full edited kit body; validated below against Appendix A
});

export async function updateKit(req: Request, res: Response) {
  const doc = await findOwnedKitOr404(req.params.id, req.user!.id);
  const { kit } = UpdateKitSchema.parse(req.body);

  const validation = validateKit(kit);
  if (!validation.valid) {
    throw new AppError(
      "INVALID_KIT_STRUCTURE",
      validation.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
      400,
    );
  }

  // Mongoose's inferred TypeScript type for an embedded document array
  // doesn't structurally match a plain array — a well-known friction
  // point with Mongoose + TypeScript that has no effect on runtime
  // behavior. validateKit() just confirmed the actual shape above, so
  // this cast only satisfies the compiler.
  doc.kit = validation.kit as unknown as typeof doc.kit;
  await doc.save();
  res.status(200).json(doc);
}

const RegenerateSchema = z.object({
  scope: z.enum(["company_brief", "schedule", "technical", "behavioural", "company-fit"]),
});

export async function regenerateKitSection(req: Request, res: Response) {
  const doc = await findOwnedKitOr404(req.params.id, req.user!.id);
  const { scope } = RegenerateSchema.parse(req.body);

  if (!doc.kit) {
    throw new AppError("KIT_NOT_READY", "This kit hasn't finished generating yet.", 409);
  }
  if (!env.OPENAI_API_KEY) {
    throw new AppError("MISSING_API_KEY", "Server is not configured with an OpenAI API key.", 500);
  }

  const updatedKit = await regenerateSection({
    kit: doc.kit as unknown as CoreKit,
    scope: scope as RegenerateScope,
    openaiApiKey: env.OPENAI_API_KEY,
  });

  const validation = validateKit(updatedKit);
  if (!validation.valid) {
    throw new AppError(
      "INVALID_KIT_STRUCTURE",
      validation.errors.map((e) => `${e.path}: ${e.message}`).join("; "),
      500,
    );
  }

  doc.kit = validation.kit as unknown as typeof doc.kit;
  await doc.save();
  res.status(200).json(doc);
}
