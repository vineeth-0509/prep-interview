import type { Kit } from "../types";

/**
 * A minimal, structurally valid Kit for use as a test fixture. Not
 * exported from the package's public index — tests only.
 */
export function makeValidKit(): Kit {
  return {
    source: {
      company: "Acme Corp",
      company_url: "https://acme.example.com",
      role: "Senior Backend Engineer",
      location: "Remote",
      jd_chars: 1200,
      researched_at: "2026-09-01T09:12:44Z",
      pages_used: ["https://acme.example.com/careers"],
    },
    company_brief: {
      summary: "Acme builds widgets.",
      what_they_do: "B2B widget SaaS.",
      sources: ["https://acme.example.com/about"],
    },
    role: {
      title: "Senior Backend Engineer",
      seniority: "Senior",
      responsibilities: ["Own the payments service"],
      requirements: [
        {
          id: "r1",
          text: "5+ years with Node.js",
          kind: "technical",
          priority: "must",
        },
        {
          id: "r2",
          text: "Mentors junior engineers",
          kind: "behavioural",
          priority: "nice",
        },
      ],
    },
    questions: [
      {
        id: "q1",
        requirement_ids: ["r1"],
        category: "technical",
        prompt: "Walk through how you'd design a rate limiter.",
        answer_outline: "Token bucket, Redis, edge cases.",
        difficulty: 2,
      },
      {
        id: "q2",
        requirement_ids: ["r2"],
        category: "behavioural",
        prompt: "Tell me about mentoring a junior engineer.",
        answer_outline: "STAR: situation, action, outcome.",
        difficulty: 1,
      },
    ],
    flashcards: [
      {
        id: "f1",
        front: "What is a token bucket?",
        back: "A rate-limiting algorithm...",
        requirement_ids: ["r1"],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        { day: 1, focus: "Technical", question_ids: ["q1"], minutes: 15 },
        { day: 2, focus: "Behavioural", question_ids: ["q2"], minutes: 10 },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };
}
