/**
 * The Kit data model.
 *
 * Appendix A of the brief fixes the field names and shapes below (source,
 * company_brief, role, questions, flashcards, schedule, coverage) — these
 * must not be renamed or restructured, since the batch pipeline (§18) is
 * run against job descriptions we have not seen and the grader compares
 * output against this exact shape.
 *
 * The `meta` object on each editable item is our own extension (spec §7),
 * used by the builder to track generated/user_edited/user_created state and
 * pinning so a regeneration never clobbers a hand-edited item. It is
 * optional at the type/schema level (Appendix A does not require it) but
 * our own pipeline always populates it once an item exists inside our app.
 */

export type RequirementKind = "technical" | "behavioural" | "domain";
export type RequirementPriority = "must" | "nice";
export type QuestionCategory =
  | "technical"
  | "behavioural"
  | "system-design"
  | "company-fit";
export type ItemSource = "generated" | "user_edited" | "user_created";

export interface ItemMeta {
  source: ItemSource;
  pinned: boolean;
  version: number;
}

export interface Requirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
  meta?: ItemMeta;
}

export interface Question {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  meta?: ItemMeta;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  meta?: ItemMeta;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number;
  meta?: ItemMeta;
}

export interface Source {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string; // ISO timestamp
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
  meta?: ItemMeta;
}

export interface Role {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: Requirement[];
}

export interface Schedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface Coverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface Kit {
  source: Source;
  company_brief: CompanyBrief;
  role: Role;
  questions: Question[];
  flashcards: Flashcard[];
  schedule: Schedule;
  coverage: Coverage;
}
