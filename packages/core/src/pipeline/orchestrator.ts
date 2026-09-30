import type { Kit } from "../types";
import { extractRequirements } from "./extractRequirements";
import { discoverHiringPages } from "./discoverHiringPages";
import { fetchPublicDiscussion } from "./fetchPublicDiscussion";
import { generateCompanyBrief } from "./generateCompanyBrief";
import { generateAllQuestions } from "./generateQuestions";
import { runCoveragePasses } from "./fillGaps";
import { deriveFlashcards } from "./deriveFlashcards";
import { guessCompanyName } from "./companyName";
import { buildSchedule } from "../scheduler";
import { validateKit } from "../schema";

/**
 * §6.2's genuine sequencing, in one place:
 *   1. extract_requirements — pasted text, no retrieval needed
 *   2. discover_hiring_pages — crawl the company site
 *   3. fetch_public_discussion — search for interview-process commentary
 *   4. generate_company_brief — grounded in steps 2+3's actual findings
 *   5. generate_questions — one call per requirement, category from kind
 *   6. fill_gaps (coverage passes) — closes must-have gaps
 *   7. derive flashcards, build the schedule, assemble coverage
 *   8. validate_and_persist — the caller persists; this returns a
 *      pre-validated Kit plus the validation result so a caller can
 *      decide what "ok" vs "failed" means for its own status field
 *
 * Steps 2 and 3 run independently (neither depends on the other's
 * output) but both must finish before step 4, which is grounded in
 * their combined findings — so they're kicked off together here.
 */

export interface RunPipelineInput {
  jdText: string;
  companyUrl: string;
  daysRequested: number;
  openaiApiKey: string;
  serperApiKey: string;
  allowLocalFetch?: boolean;
}

export interface RunPipelineDeps {
  extractDeps?: Parameters<typeof extractRequirements>[2];
  crawlDeps?: Parameters<typeof discoverHiringPages>[2];
  discussionDeps?: Parameters<typeof fetchPublicDiscussion>[3];
  briefDeps?: Parameters<typeof generateCompanyBrief>[4];
  questionsDeps?: Parameters<typeof generateAllQuestions>[3];
  /** Called after each major step completes — the server persists this
   *  as current_step/steps_completed so the UI can show real progress
   *  during a generation that can take up to ~90 seconds (§12/§13). */
  onStep?: (step: string) => void | Promise<void>;
}

export interface RunPipelineResult {
  kit: Kit;
  valid: boolean;
  validationErrors: Array<{ path: string; message: string }>;
  skippedSources: Array<{ url: string; reason: string }>;
}

export async function runPipeline(
  input: RunPipelineInput,
  deps: RunPipelineDeps = {},
): Promise<RunPipelineResult> {
  const { jdText, companyUrl, daysRequested, openaiApiKey, serperApiKey, allowLocalFetch } = input;
  const emit = async (step: string) => {
    if (deps.onStep) await deps.onStep(step);
  };

  const extraction = await extractRequirements(jdText, openaiApiKey, deps.extractDeps);
  await emit("extract_requirements");
  const companyNameGuess = guessCompanyName(companyUrl);

  const [crawl, discussion] = await Promise.all([
    discoverHiringPages(companyUrl, { allowLocal: allowLocalFetch }, deps.crawlDeps),
    fetchPublicDiscussion(companyNameGuess, serperApiKey, { allowLocal: allowLocalFetch }, deps.discussionDeps),
  ]);
  await emit("discover_hiring_pages");
  await emit("fetch_public_discussion");

  const companyBrief = await generateCompanyBrief(
    companyNameGuess,
    crawl.pages.map((p) => ({ url: p.url, title: p.title, text: p.text })),
    discussion.sources.map((s) => ({ url: s.url, title: s.title, text: s.text })),
    openaiApiKey,
    deps.briefDeps,
  );
  await emit("generate_company_brief");

  const role = { title: extraction.title, seniority: extraction.seniority };
  const initialGeneration = await generateAllQuestions(
    extraction.requirements,
    role,
    openaiApiKey,
    deps.questionsDeps,
  );
  await emit("generate_questions");

  const { questions, passes, uncoveredRequirementIds } = await runCoveragePasses(
    extraction.requirements,
    initialGeneration.questions,
    role,
    openaiApiKey,
    deps.questionsDeps,
  );
  await emit("fill_gaps");

  const flashcards = deriveFlashcards(questions);
  const schedule = buildSchedule(extraction.requirements, questions, daysRequested);
  const coverage = { uncovered_requirement_ids: uncoveredRequirementIds, passes };
  await emit("build_schedule");

  const kit: Kit = {
    source: {
      company: companyNameGuess,
      company_url: companyUrl,
      role: extraction.title,
      location: "",
      jd_chars: jdText.length,
      researched_at: new Date().toISOString(),
      pages_used: crawl.pages.map((p) => p.url),
    },
    company_brief: companyBrief,
    role: {
      title: extraction.title,
      seniority: extraction.seniority,
      responsibilities: extraction.responsibilities,
      requirements: extraction.requirements,
    },
    questions,
    flashcards,
    schedule,
    coverage,
  };

  const validation = validateKit(kit);
  await emit("validate");
  const skippedSources = [...crawl.skipped, ...discussion.skipped];

  return {
    kit,
    valid: validation.valid,
    validationErrors: validation.valid ? [] : validation.errors,
    skippedSources,
  };
}
