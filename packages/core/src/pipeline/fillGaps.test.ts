import { describe, expect, it } from "vitest";
import { runCoveragePasses } from "./fillGaps";
import type { Question, Requirement } from "../types";

const role = { title: "Senior Backend Engineer", seniority: "Senior" };

const req = (id: string): Requirement => ({
  id,
  text: `requirement text for ${id}`,
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

const oneQuestionResponse = {
  questions: [{ prompt: "Q?", answer_outline: "A", difficulty: 2 }],
};

describe("runCoveragePasses", () => {
  it("does nothing extra when the initial draft already has full coverage", async () => {
    let calls = 0;
    const requirements = [req("r1")];
    const initialQuestions = [q("q1", ["r1"])];
    const result = await runCoveragePasses(requirements, initialQuestions, role, "fake-key", {
      callModel: async () => {
        calls++;
        return oneQuestionResponse;
      },
    });
    expect(calls).toBe(0);
    expect(result.passes).toBe(1);
    expect(result.uncoveredRequirementIds).toEqual([]);
  });

  it("fills a gap on the second pass and continues id numbering", async () => {
    const requirements = [req("r1"), req("r2")];
    const initialQuestions = [q("q1", ["r1"])]; // r2 is uncovered

    const result = await runCoveragePasses(requirements, initialQuestions, role, "fake-key", {
      callModel: async () => oneQuestionResponse,
    });

    expect(result.passes).toBe(2);
    expect(result.uncoveredRequirementIds).toEqual([]);
    const newQuestion = result.questions.find((qq) => qq.requirement_ids.includes("r2"));
    expect(newQuestion?.id).toBe("q2"); // continues numbering, doesn't collide with q1
  });

  it("reports a requirement as still uncovered if the gap-fill pass also fails, without looping forever", async () => {
    const requirements = [req("r1"), req("r2")];
    const initialQuestions = [q("q1", ["r1"])];

    const result = await runCoveragePasses(requirements, initialQuestions, role, "fake-key", {
      callModel: async () => ({ nonsense: true }), // every call for r2 fails
    });

    expect(result.passes).toBe(2);
    expect(result.uncoveredRequirementIds).toEqual(["r2"]);
  });
});
