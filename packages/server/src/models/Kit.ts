import { Schema, model, Types } from "mongoose";

/**
 * This schema mirrors the Kit structure from Appendix A field-for-field
 * (source / company_brief / role / questions / flashcards / schedule /
 * coverage), plus:
 *   - owner_id: enforced on every kit route per §5 ("users can read and
 *     modify only their own kits") — checked at the query level, not just
 *     the UI, so a route can't accidentally serve another user's kit.
 *   - pipeline_status / current_step / steps_completed / pipeline_error:
 *     persisted state for the §6.2 step machine, so a page refresh
 *     mid-generation doesn't lose progress and the CLI/web app share one
 *     resumable model.
 *   - content_hash: hash of (jd_text, company_url), used for the §9
 *     duplicate-submission dedupe check.
 *
 * Appendix A's exact structure is still validated independently against
 * the @aipk/core zod schema before every save (§4/§13) — that's the real
 * gate on correctness. This Mongoose schema is about persistence shape.
 *
 * Important gotcha, fixed here: Mongoose's built-in `required` validator
 * on a String field treats an empty string "" as "missing" and rejects
 * it — but several Appendix A fields are legitimately empty strings by
 * design (e.g. company_brief.what_they_do when nothing was found about
 * the company, §10). `required: true` is only used below where the
 * @aipk/core zod schema also guarantees a non-empty value (ids, enums,
 * prompt/text/front/back, company_url, researched_at); every field zod
 * allows to be "" is deliberately NOT required here, or the very next
 * legitimately-thin kit fails to save.
 */

const ItemMetaSchema = new Schema(
  {
    source: {
      type: String,
      enum: ["generated", "user_edited", "user_created"],
      required: true,
    },
    pinned: { type: Boolean, required: true },
    version: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const RequirementSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    kind: { type: String, enum: ["technical", "behavioural", "domain"], required: true },
    priority: { type: String, enum: ["must", "nice"], required: true },
    meta: { type: ItemMetaSchema, required: false },
  },
  { _id: false },
);

const QuestionSchema = new Schema(
  {
    id: { type: String, required: true },
    requirement_ids: { type: [String], required: true, default: [] },
    category: {
      type: String,
      enum: ["technical", "behavioural", "system-design", "company-fit"],
      required: true,
    },
    prompt: { type: String, required: true },
    answer_outline: { type: String, default: "" }, // zod allows "" — not required
    difficulty: { type: Number, enum: [1, 2, 3], required: true },
    meta: { type: ItemMetaSchema, required: false },
  },
  { _id: false },
);

const FlashcardSchema = new Schema(
  {
    id: { type: String, required: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    requirement_ids: { type: [String], required: true, default: [] },
    meta: { type: ItemMetaSchema, required: false },
  },
  { _id: false },
);

const ScheduleDaySchema = new Schema(
  {
    day: { type: Number, required: true },
    focus: { type: String, default: "" }, // zod allows "" — not required
    question_ids: { type: [String], required: true, default: [] },
    minutes: { type: Number, required: true },
    meta: { type: ItemMetaSchema, required: false },
  },
  { _id: false },
);

const KitBodySchema = new Schema(
  {
    source: {
      company: { type: String, default: "" }, // zod allows "" — not required
      company_url: { type: String, required: true }, // zod requires a valid URL
      role: { type: String, default: "" }, // zod allows "" — not required
      location: { type: String, default: "" }, // zod allows "" — not required
      jd_chars: { type: Number, required: true, default: 0 },
      researched_at: { type: String, required: true }, // zod requires a valid timestamp
      pages_used: { type: [String], required: true, default: [] },
    },
    company_brief: {
      summary: { type: String, default: "" }, // zod allows "" — not required
      what_they_do: { type: String, default: "" }, // always "" when nothing was found (§10)
      sources: { type: [String], required: true, default: [] },
      meta: { type: ItemMetaSchema, required: false },
    },
    role: {
      title: { type: String, default: "" }, // zod allows "" — not required
      seniority: { type: String, default: "" }, // zod allows "" — not required
      responsibilities: { type: [String], required: true, default: [] },
      requirements: { type: [RequirementSchema], required: true, default: [] },
    },
    questions: { type: [QuestionSchema], required: true, default: [] },
    flashcards: { type: [FlashcardSchema], required: true, default: [] },
    schedule: {
      days_available: { type: Number, required: true, default: 0 },
      days: { type: [ScheduleDaySchema], required: true, default: [] },
    },
    coverage: {
      uncovered_requirement_ids: { type: [String], required: true, default: [] },
      passes: { type: Number, required: true, default: 0 },
    },
  },
  { _id: false },
);

const PipelineErrorSchema = new Schema(
  {
    code: { type: String, required: true },
    message: { type: String, required: true },
    step: { type: String, required: false },
  },
  { _id: false },
);

const KitSchema = new Schema(
  {
    owner_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jd_text: { type: String, required: true },
    company_url: { type: String, required: true },
    days_requested: { type: Number, required: true },
    content_hash: { type: String, required: true, index: true },

    pipeline_status: {
      type: String,
      enum: ["idle", "running", "completed", "failed"],
      required: true,
      default: "idle",
    },
    current_step: { type: String, required: false },
    steps_completed: { type: [String], required: true, default: [] },
    pipeline_error: { type: PipelineErrorSchema, required: false, default: null },

    kit: { type: KitBodySchema, required: false, default: null },
  },
  { timestamps: true },
);

// Same owner submitting the same (jd_text, company_url) pair should hit
// the §9 dedupe path rather than silently allow unlimited duplicate runs.
KitSchema.index({ owner_id: 1, content_hash: 1 });

export const Kit = model("Kit", KitSchema);
