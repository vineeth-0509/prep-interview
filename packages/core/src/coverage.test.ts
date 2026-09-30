import { describe, expect, it } from "vitest";
import { buildCoverage, checkCoverage, isFullyCovered } from "./coverage";
import type { Question, Requirement } from "./types";

const req = (id: string): Requirement => ({
  id,
  text: `requirement ${id}`,
  kind: "technical",
  priority: "must",
});

const q = (id: string, requirement_ids: string[]): Question => ({
  id,
  requirement_ids,
  category: "technical",
  prompt: "",
  answer_outline: "",
  difficulty: 1,
});

describe("checkCoverage", () => {
  it("returns no gaps when every requirement has a question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    expect(checkCoverage(requirements, questions)).toEqual([]);
  });

  it("flags a requirement with no covering question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"])];
    expect(checkCoverage(requirements, questions)).toEqual(["r2"]);
  });

  it("lets one question cover multiple requirements", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1", "r2"])];
    expect(checkCoverage(requirements, questions)).toEqual([]);
  });

  it("handles zero requirements", () => {
    expect(checkCoverage([], [q("q1", ["r1"])])).toEqual([]);
  });

  it("handles zero questions", () => {
    const requirements = [req("r1"), req("r2")];
    expect(checkCoverage(requirements, [])).toEqual(["r1", "r2"]);
  });

  it("clears a gap once a gap-fill question is added (second pass)", () => {
    const requirements = [req("r1"), req("r2")];
    let questions = [q("q1", ["r1"])];
    expect(checkCoverage(requirements, questions)).toEqual(["r2"]);

    // simulate fill_gaps generating a question for the missing requirement
    questions = [...questions, q("q2", ["r2"])];
    expect(checkCoverage(requirements, questions)).toEqual([]);
  });
});

describe("buildCoverage", () => {
  it("wraps the uncovered list with the pass count", () => {
    const requirements = [req("r1")];
    expect(buildCoverage(requirements, [], 1)).toEqual({
      uncovered_requirement_ids: ["r1"],
      passes: 1,
    });
  });
});

describe("isFullyCovered", () => {
  it("is true iff no requirement is uncovered", () => {
    const requirements = [req("r1")];
    expect(isFullyCovered(requirements, [])).toBe(false);
    expect(isFullyCovered(requirements, [q("q1", ["r1"])])).toBe(true);
  });
});
