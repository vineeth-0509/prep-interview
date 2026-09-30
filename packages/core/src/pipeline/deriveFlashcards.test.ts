import { describe, expect, it } from "vitest";
import { deriveFlashcards } from "./deriveFlashcards";
import type { Question } from "../types";

const q = (id: string, prompt: string, answer_outline: string, requirement_ids: string[]): Question => ({
  id,
  requirement_ids,
  category: "technical",
  prompt,
  answer_outline,
  difficulty: 2,
});

describe("deriveFlashcards", () => {
  it("creates one flashcard per question, carrying over requirement_ids", () => {
    const questions = [q("q1", "What is a token bucket?", "Rate-limiting algorithm...", ["r1"])];
    const flashcards = deriveFlashcards(questions);
    expect(flashcards).toHaveLength(1);
    expect(flashcards[0]).toMatchObject({
      id: "f1",
      front: "What is a token bucket?",
      back: "Rate-limiting algorithm...",
      requirement_ids: ["r1"],
    });
  });

  it("assigns sequential ids", () => {
    const questions = [
      q("q1", "Q1?", "A1", ["r1"]),
      q("q2", "Q2?", "A2", ["r2"]),
    ];
    const flashcards = deriveFlashcards(questions);
    expect(flashcards.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("falls back to a placeholder when answer_outline is empty", () => {
    const flashcards = deriveFlashcards([q("q1", "Q?", "", ["r1"])]);
    expect(flashcards[0].back).toBe("(no outline provided)");
  });

  it("continues id numbering from startIndex when provided", () => {
    const flashcards = deriveFlashcards([q("q9", "Q?", "A", ["r1"])], 5);
    expect(flashcards[0].id).toBe("f5");
  });

  it("marks every flashcard as generated/unpinned", () => {
    const flashcards = deriveFlashcards([q("q1", "Q?", "A", ["r1"])]);
    expect(flashcards[0].meta).toEqual({ source: "generated", pinned: false, version: 0 });
  });
});
