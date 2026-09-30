import { describe, expect, it } from "vitest";
import {
  QuestionGenerationError,
  generateAllQuestions,
  generateQuestionsForRequirement,
} from "./generateQuestions";
import type { Requirement } from "../types";

const role = { title: "Senior Backend Engineer", seniority: "Senior" };

const req = (id: string, kind: Requirement["kind"]): Requirement => ({
  id,
  text: `requirement text for ${id}`,
  kind,
  priority: "must",
});

const oneQuestionResponse = {
  questions: [{ prompt: "Tell me about X.", answer_outline: "Cover Y and Z.", difficulty: 2 }],
};

describe("generateQuestionsForRequirement", () => {
  it("maps technical requirements to the technical category", async () => {
    const questions = await generateQuestionsForRequirement(req("r1", "technical"), role, "fake-key", {
      callModel: async () => oneQuestionResponse,
    });
    expect(questions[0].category).toBe("technical");
  });

  it("maps behavioural requirements to the behavioural category", async () => {
    const questions = await generateQuestionsForRequirement(req("r1", "behavioural"), role, "fake-key", {
      callModel: async () => oneQuestionResponse,
    });
    expect(questions[0].category).toBe("behavioural");
  });

  it("maps domain requirements to the company-fit category", async () => {
    const questions = await generateQuestionsForRequirement(req("r1", "domain"), role, "fake-key", {
      callModel: async () => oneQuestionResponse,
    });
    expect(questions[0].category).toBe("company-fit");
  });

  it("retries once on a malformed response, then succeeds", async () => {
    let calls = 0;
    const questions = await generateQuestionsForRequirement(req("r1", "technical"), role, "fake-key", {
      callModel: async () => {
        calls++;
        return calls === 1 ? { nonsense: true } : oneQuestionResponse;
      },
    });
    expect(calls).toBe(2);
    expect(questions).toHaveLength(1);
  });

  it("throws QuestionGenerationError carrying the requirement id after exhausting attempts", async () => {
    await expect(
      generateQuestionsForRequirement(req("r7", "technical"), role, "fake-key", {
        callModel: async () => ({ nonsense: true }),
      }),
    ).rejects.toMatchObject({ requirementId: "r7" });
  });
});

describe("generateAllQuestions", () => {
  it("assigns sequential ids across all requirements' questions", async () => {
    const requirements = [req("r1", "technical"), req("r2", "behavioural")];
    const { questions } = await generateAllQuestions(requirements, role, "fake-key", {
      callModel: async () => oneQuestionResponse,
    });
    expect(questions.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  it("isolates a single requirement's failure — others still succeed", async () => {
    const requirements = [req("r1", "technical"), req("r2", "behavioural"), req("r3", "domain")];
    const { questions, failedRequirementIds } = await generateAllQuestions(requirements, role, "fake-key", {
      callModel: async (params) => {
        if (params.user.includes("requirement text for r2")) {
          return { nonsense: true };
        }
        return oneQuestionResponse;
      },
    });

    expect(failedRequirementIds).toEqual(["r2"]);
    const coveredRequirementIds = new Set(questions.flatMap((q) => q.requirement_ids));
    expect(coveredRequirementIds.has("r1")).toBe(true);
    expect(coveredRequirementIds.has("r3")).toBe(true);
    expect(coveredRequirementIds.has("r2")).toBe(false);
  });

  it("continues id numbering from startIndex (used by fill_gaps)", async () => {
    const { questions } = await generateAllQuestions([req("r5", "technical")], role, "fake-key", {
      callModel: async () => oneQuestionResponse,
    }, { startIndex: 9 });
    expect(questions.map((q) => q.id)).toEqual(["q9"]);
  });

  it("marks every generated question as generated/unpinned", async () => {
    const { questions } = await generateAllQuestions([req("r1", "technical")], role, "fake-key", {
      callModel: async () => oneQuestionResponse,
    });
    expect(questions[0].meta).toEqual({ source: "generated", pinned: false, version: 0 });
  });
});
