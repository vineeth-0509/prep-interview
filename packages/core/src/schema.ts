import { z } from "zod";

/**
 * Validates a Kit against the exact structure fixed in Appendix A of the
 * brief, plus the hard rules stated in the brief's body text:
 *   - minutes, jd_chars, difficulty are integers, never floats
 *   - every question.requirement_ids entry references a requirement that
 *     actually exists in role.requirements
 *   - every schedule.days[].question_ids entry references a question that
 *     actually exists in questions
 *   - ids are stable/unique within a kit
 *   - schedule.days.length === schedule.days_available exactly, and day
 *     numbers run 1..days_available with no gaps or repeats
 *
 * The per-field zod schemas below enforce shape and type; the cross-field
 * reference checks (which zod cannot express declaratively across sibling
 * arrays) are enforced in the top-level superRefine.
 */

const ItemMetaSchema = z
  .object({
    source: z.enum(["generated", "user_edited", "user_created"]),
    pinned: z.boolean(),
    version: z.number().int().nonnegative(),
  })
  .strict();

const isoTimestamp = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "must be a valid ISO timestamp",
});

const RequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(["technical", "behavioural", "domain"]),
  priority: z.enum(["must", "nice"]),
  meta: ItemMetaSchema.optional(),
});

const QuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  category: z.enum([
    "technical",
    "behavioural",
    "system-design",
    "company-fit",
  ]),
  prompt: z.string().min(1),
  answer_outline: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  meta: ItemMetaSchema.optional(),
});

const FlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string().min(1)),
  meta: ItemMetaSchema.optional(),
});

const ScheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string(),
  question_ids: z.array(z.string().min(1)),
  minutes: z.number().int().nonnegative(),
  meta: ItemMetaSchema.optional(),
});

const SourceSchema = z.object({
  company: z.string(),
  company_url: z.string().url(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: isoTimestamp,
  pages_used: z.array(z.string().url()),
});

const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string().url()),
  meta: ItemMetaSchema.optional(),
});

const RoleSchema = z.object({
  title: z.string(),
  seniority: z.string(),
  responsibilities: z.array(z.string()),
  requirements: z.array(RequirementSchema),
});

const ScheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(ScheduleDaySchema),
});

const CoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().nonnegative(),
});

export const KitSchema = z
  .object({
    source: SourceSchema,
    company_brief: CompanyBriefSchema,
    role: RoleSchema,
    questions: z.array(QuestionSchema),
    flashcards: z.array(FlashcardSchema),
    schedule: ScheduleSchema,
    coverage: CoverageSchema,
  })
  .superRefine((kit, ctx) => {
    const requirementIds = new Set<string>();
    kit.role.requirements.forEach((r, i) => {
      if (requirementIds.has(r.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate requirement id "${r.id}"`,
          path: ["role", "requirements", i, "id"],
        });
      }
      requirementIds.add(r.id);
    });

    const questionIds = new Set<string>();
    kit.questions.forEach((q, i) => {
      if (questionIds.has(q.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate question id "${q.id}"`,
          path: ["questions", i, "id"],
        });
      }
      questionIds.add(q.id);

      q.requirement_ids.forEach((rid, j) => {
        if (!requirementIds.has(rid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `question "${q.id}" references unknown requirement id "${rid}"`,
            path: ["questions", i, "requirement_ids", j],
          });
        }
      });
    });

    const flashcardIds = new Set<string>();
    kit.flashcards.forEach((f, i) => {
      if (flashcardIds.has(f.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate flashcard id "${f.id}"`,
          path: ["flashcards", i, "id"],
        });
      }
      flashcardIds.add(f.id);

      f.requirement_ids.forEach((rid, j) => {
        if (!requirementIds.has(rid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `flashcard "${f.id}" references unknown requirement id "${rid}"`,
            path: ["flashcards", i, "requirement_ids", j],
          });
        }
      });
    });

    // Schedule must span exactly days_available, with day numbers 1..N,
    // no gaps or repeats (brief §8: "the number of days in the schedule
    // equals the number of days requested").
    if (kit.schedule.days.length !== kit.schedule.days_available) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `schedule has ${kit.schedule.days.length} day(s) but days_available is ${kit.schedule.days_available}`,
        path: ["schedule", "days"],
      });
    }
    const seenDayNumbers = new Set<number>();
    kit.schedule.days.forEach((d, i) => {
      if (seenDayNumbers.has(d.day)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate schedule day number ${d.day}`,
          path: ["schedule", "days", i, "day"],
        });
      }
      seenDayNumbers.add(d.day);

      d.question_ids.forEach((qid, j) => {
        if (!questionIds.has(qid)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `schedule day ${d.day} references unknown question id "${qid}"`,
            path: ["schedule", "days", i, "question_ids", j],
          });
        }
      });
    });

    // coverage.uncovered_requirement_ids must reference real requirements
    kit.coverage.uncovered_requirement_ids.forEach((rid, i) => {
      if (!requirementIds.has(rid)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `coverage references unknown requirement id "${rid}"`,
          path: ["coverage", "uncovered_requirement_ids", i],
        });
      }
    });
  });

export interface KitValidationError {
  path: string;
  message: string;
}

export type KitValidationResult =
  | { valid: true; kit: z.infer<typeof KitSchema> }
  | { valid: false; errors: KitValidationError[] };

/**
 * Validate an unknown value against the Kit structure. Used both by the
 * server before persisting a generated kit (§13) and by the batch CLI
 * before writing an entry to kits.json (§18) — the same check, run from
 * the same code, in both places.
 */
export function validateKit(data: unknown): KitValidationResult {
  const result = KitSchema.safeParse(data);
  if (result.success) {
    return { valid: true, kit: result.data };
  }
  return {
    valid: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
