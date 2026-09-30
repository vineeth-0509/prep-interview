import { runPipeline } from "@aipk/core";
import { Kit } from "../models/Kit";
import { env } from "../config/env";

/**
 * §13: "Generation is slow, external and failure-prone. Consider what
 * happens when it takes ninety seconds, fails halfway, or is triggered
 * twice for the same posting." This runs detached from the HTTP request
 * that created the kit (the controller responds 202 immediately) and
 * persists progress as it goes, so:
 *   - a page refresh mid-generation just re-polls GET /api/kits/:id and
 *     sees the same in-progress state, rather than losing it
 *   - a failure partway through is recorded with a structured error
 *     rather than leaving the kit stuck at pipeline_status: "running"
 *     forever
 *   - "triggered twice for the same posting" is prevented one layer up,
 *     in the controller's content-hash dedupe check before this ever runs
 */
export async function runAndPersistPipeline(kitId: string): Promise<void> {
  const doc = await Kit.findById(kitId);
  if (!doc) return;

  try {
    doc.pipeline_status = "running";
    doc.current_step = undefined;
    doc.steps_completed = [];
    doc.pipeline_error = null;
    await doc.save();

    const result = await runPipeline(
      {
        jdText: doc.jd_text,
        companyUrl: doc.company_url,
        daysRequested: doc.days_requested,
        openaiApiKey: env.OPENAI_API_KEY ?? "",
        serperApiKey: env.SEARCH_API_KEY ?? "",
        allowLocalFetch: env.ALLOW_LOCAL_FETCH,
      },
      {
        onStep: async (step) => {
          doc.current_step = step;
          doc.steps_completed = [...doc.steps_completed, step];
          await doc.save();
        },
      },
    );

    if (!result.valid) {
      doc.pipeline_status = "failed";
      doc.pipeline_error = {
        code: "INVALID_KIT_STRUCTURE",
        message: result.validationErrors.map((e) => `${e.path}: ${e.message}`).join("; "),
      };
      await doc.save();
      return;
    }

    // Same Mongoose-vs-plain-object typing friction as kitController.ts —
    // runPipeline() already validated the shape (result.valid check
    // above), so this cast only satisfies the compiler.
    doc.kit = result.kit as unknown as typeof doc.kit;
    doc.pipeline_status = "completed";
    doc.current_step = undefined;
    await doc.save();
  } catch (err) {
    doc.pipeline_status = "failed";
    doc.pipeline_error = {
      code: "PIPELINE_ERROR",
      message: err instanceof Error ? err.message : "Unknown pipeline error",
    };
    await doc.save();
  }
}
