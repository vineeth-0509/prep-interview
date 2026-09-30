import { describe, expect, it } from "vitest";
import { runPipeline } from "./orchestrator";
import type { FetchResult } from "./fetchPage";
import type { SerperResult } from "./fetchPublicDiscussion";

const extractionResponse = {
  title: "Senior Backend Engineer",
  seniority: "Senior",
  responsibilities: ["Own the payments service"],
  requirements: [
    { text: "5+ years with Node.js", source_phrase: "5+ years of Node.js required", kind: "technical" },
    { text: "Mentors junior engineers", source_phrase: "Bonus points for mentoring", kind: "behavioural" },
  ],
};

const fixturePages: Record<string, FetchResult> = {
  "https://acme.test/": {
    ok: true,
    url: "https://acme.test/",
    title: "Acme",
    text: "Acme builds widgets.",
    bytes: 100,
    links: [{ url: "https://acme.test/careers", anchorText: "Careers" }],
  },
  "https://acme.test/careers": {
    ok: true,
    url: "https://acme.test/careers",
    title: "Careers",
    text: "We interview with a take-home and a system design round.",
    bytes: 100,
    links: [],
  },
};

const oneQuestionResponse = {
  questions: [{ prompt: "Tell me about X.", answer_outline: "Cover Y.", difficulty: 2 }],
};

const companyBriefResponse = {
  summary: "Acme builds widgets.",
  what_they_do: "B2B widget SaaS.",
  cited_urls: ["https://acme.test/"],
};

describe("runPipeline", () => {
  it("assembles a fully valid Kit from fixture data end-to-end", async () => {
    const result = await runPipeline(
      {
        jdText: "Senior Backend Engineer job description text",
        companyUrl: "https://acme.test/",
        daysRequested: 5,
        openaiApiKey: "fake-openai-key",
        serperApiKey: "fake-serper-key",
        allowLocalFetch: true,
      },
      {
        extractDeps: { callModel: async () => extractionResponse },
        crawlDeps: { fetchPageFn: async (url) => fixturePages[url] ?? { ok: false, url, reason: "not_in_fixture" } },
        discussionDeps: {
          searchFn: async (): Promise<SerperResult[]> => [
            { title: "Acme interview review", link: "https://reddit.com/acme", snippet: "..." },
          ],
          fetchPageFn: async (url) => ({
            ok: true,
            url,
            title: "Discussion",
            text: "Two rounds: take-home then system design.",
            bytes: 50,
            links: [],
          }),
        },
        briefDeps: { callModel: async () => companyBriefResponse },
        questionsDeps: { callModel: async () => oneQuestionResponse },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.validationErrors).toEqual([]);

    const { kit } = result;
    expect(kit.role.requirements).toHaveLength(2);
    expect(kit.questions).toHaveLength(2);
    expect(kit.flashcards).toHaveLength(2);
    expect(kit.schedule.days_available).toBe(5);
    expect(kit.schedule.days).toHaveLength(5);
    expect(kit.coverage.uncovered_requirement_ids).toEqual([]);
    expect(kit.coverage.passes).toBe(1); // full coverage on the first pass, no gap-fill needed
    expect(kit.source.company).toBe("Acme");
    expect(kit.source.pages_used).toContain("https://acme.test/careers");
    expect(kit.company_brief.summary).toBe("Acme builds widgets.");
  });

  it("still produces a valid (if thin) Kit when crawl and discussion both find nothing", async () => {
    const result = await runPipeline(
      {
        jdText: "Two-line stub JD.",
        companyUrl: "https://nowhere.test/",
        daysRequested: 1,
        openaiApiKey: "fake-openai-key",
        serperApiKey: "fake-serper-key",
        allowLocalFetch: true,
      },
      {
        extractDeps: {
          callModel: async () => ({
            title: "Engineer",
            seniority: "Unknown",
            responsibilities: [],
            requirements: [
              { text: "Some experience", source_phrase: "some experience needed", kind: "technical" },
            ],
          }),
        },
        crawlDeps: { fetchPageFn: async (url) => ({ ok: false, url, reason: "not_found" }) },
        discussionDeps: { searchFn: async () => [] },
        questionsDeps: { callModel: async () => oneQuestionResponse },
      },
    );

    expect(result.valid).toBe(true);
    expect(result.kit.company_brief.sources).toEqual([]);
    expect(result.kit.company_brief.summary.toLowerCase()).toContain("no public information");
    expect(result.kit.source.pages_used).toEqual([]);
  });
});
