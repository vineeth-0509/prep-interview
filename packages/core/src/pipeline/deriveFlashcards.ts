import type { Flashcard, Question } from "../types";

/**
 * Appendix A requires a flashcards array, but neither the brief's
 * numbered pipeline steps nor its sequencing example mention a separate
 * flashcard-generation call. Deriving one flashcard per question (front:
 * the question prompt, back: its answer outline) is deterministic, free
 * of additional LLM/token cost on a rate-limited free tier, and directly
 * testable — a defensible trade against a dedicated LLM call for
 * marginally more varied flashcard phrasing.
 */
export function deriveFlashcards(questions: Question[], startIndex = 1): Flashcard[] {
  return questions.map((q, i) => ({
    id: `f${startIndex + i}`,
    front: q.prompt,
    back: q.answer_outline || "(no outline provided)",
    requirement_ids: [...q.requirement_ids],
    meta: { source: "generated", pinned: false, version: 0 },
  }));
}
