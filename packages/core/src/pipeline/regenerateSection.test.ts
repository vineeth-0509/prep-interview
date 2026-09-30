import { describe, expect, it } from "vitest";
import { regenerateSection } from "./regenerateSection";
import type { Kit } from "../types";

function baseKit(): Kit {
  return {
    source: {
      company: "Acme",
      company_url: "https://acme.test/",
      role: "Senior Backend Engineer",
      location: "",
      jd_chars: 100,
      researched_at: new Date().toISOString(),
      pages_used: ["https://acme.test/careers"],
    },
    company_brief: {
      summary: "Old summary",
      what_they_do: "Old",
      sources: ["https://acme.test/careers"],
      meta: { source: "generated", pinned: false, version: 0 },
    },
    role: {
      title: "Senior Backend Engineer",
      seniority: "Senior",
      responsibilities: [],
      requirements: [
        { id: "r1", text: "5+ years Node.js", kind: "technical", priority: "must" },
        { id: "r2", text: "Mentors juniors", kind: "behavioural", priority: "nice" },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Old technical question",
        answer_outline: "Old outline",
        difficulty: 2,
        meta: { source: "generated", pinned: false, version: 0 },
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "behavioural",
        prompt: "Old behavioural question",
        answer_outline: "Old outline",
        difficulty: 1,
        meta: { source: "generated", pinned: false, version: 0 },
      },
    ],
    flashcards: [
      { id: "f1", front: "Old technical question", back: "Old outline", requirement_ids: ["r1"], meta: { source: "generated", pinned: false, version: 0 } },
      { id: "f2", front: "Old behavioural question", back: "Old outline", requirement_ids: ["r2"], meta: { source: "generated", pinned: false, version: 0 } },
    ],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: "Technical", question_ids: ["q1"], minutes: 15 },
        { day: 2, focus: "Behavioural", question_ids: ["q2"], minutes: 10 },
      ],
    },
    coverage: { uncovered_requirement_ids: [], passes: 1 },
  };
}

const freshQuestionResponse = {
  questions: [{ prompt: "Fresh question", answer_outline: "Fresh outline", difficulty: 3 }],
};

describe("regenerateSection: company_brief", () => {
  it("replaces an untouched brief with freshly generated content", async () => {
    const kit = baseKit();
    const result = await regenerateSection(
      { kit, scope: "company_brief", openaiApiKey: "fake-key" },
      {
        fetchPageFn: async (url) => ({ ok: true, url, title: "Careers", text: "New content", bytes: 10, links: [] }),
        briefDeps: { callModel: async () => ({ summary: "Fresh summary", what_they_do: "Fresh", cited_urls: [] }) },
      },
    );
    expect(result.company_brief.summary).toBe("Fresh summary");
  });

  it("preserves a pinned brief untouched", async () => {
    const kit = baseKit();
    kit.company_brief.meta = { source: "generated", pinned: true, version: 0 };
    const result = await regenerateSection(
      { kit, scope: "company_brief", openaiApiKey: "fake-key" },
      {
        fetchPageFn: async (url) => ({ ok: true, url, title: "Careers", text: "New content", bytes: 10, links: [] }),
        briefDeps: { callModel: async () => ({ summary: "Fresh summary", what_they_do: "Fresh", cited_urls: [] }) },
      },
    );
    expect(result.company_brief.summary).toBe("Old summary");
  });
});

describe("regenerateSection: schedule", () => {
  it("recomputes unpinned days but preserves a pinned day", async () => {
    const kit = baseKit();
    kit.schedule.days[0].meta = { source: "generated", pinned: true, version: 0 };
    kit.schedule.days[0].focus = "My pinned focus";

    const result = await regenerateSection({ kit, scope: "schedule", openaiApiKey: "fake-key" });

    expect(result.schedule.days.find((d) => d.day === 1)?.focus).toBe("My pinned focus");
    expect(result.schedule.days).toHaveLength(2);
  });
});

describe("regenerateSection: question category", () => {
  it("replaces untouched technical questions and cascades to flashcards/schedule/coverage", async () => {
    const kit = baseKit();
    const result = await regenerateSection(
      { kit, scope: "technical", openaiApiKey: "fake-key" },
      { questionsDeps: { callModel: async () => freshQuestionResponse } },
    );

    // old technical question replaced, behavioural question untouched
    const technicalQuestions = result.questions.filter((q) => q.category === "technical");
    expect(technicalQuestions.map((q) => q.prompt)).toEqual(["Fresh question"]);
    expect(result.questions.some((q) => q.prompt === "Old behavioural question")).toBe(true);

    // flashcards cascade for the new technical question
    expect(result.flashcards.some((f) => f.front === "Fresh question")).toBe(true);
    // old behavioural flashcard untouched
    expect(result.flashcards.some((f) => f.front === "Old behavioural question")).toBe(true);

    // coverage still complete
    expect(result.coverage.uncovered_requirement_ids).toEqual([]);
    expect(result.coverage.passes).toBe(2);

    // schedule still references only real question ids
    const validQuestionIds = new Set(result.questions.map((q) => q.id));
    for (const day of result.schedule.days) {
      for (const qid of day.question_ids) {
        expect(validQuestionIds.has(qid)).toBe(true);
      }
    }
  });

  it("preserves a pinned technical question instead of replacing it", async () => {
    const kit = baseKit();
    kit.questions[0].meta = { source: "generated", pinned: true, version: 0 };

    const result = await regenerateSection(
      { kit, scope: "technical", openaiApiKey: "fake-key" },
      { questionsDeps: { callModel: async () => freshQuestionResponse } },
    );

    const technicalQuestions = result.questions.filter((q) => q.category === "technical");
    expect(technicalQuestions.map((q) => q.id)).toEqual(["q1"]);
    expect(technicalQuestions[0].prompt).toBe("Old technical question");
  });

  it("does not disturb the other category's questions or flashcards at all", async () => {
    const kit = baseKit();
    const result = await regenerateSection(
      { kit, scope: "technical", openaiApiKey: "fake-key" },
      { questionsDeps: { callModel: async () => freshQuestionResponse } },
    );
    const behaviouralQuestion = result.questions.find((q) => q.id === "q2");
    expect(behaviouralQuestion?.prompt).toBe("Old behavioural question");
  });
});
