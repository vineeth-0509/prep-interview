import type { Question, Requirement } from "../types";
import { checkCoverage } from "../coverage";
import { generateAllQuestions, type GenerateQuestionsDeps } from "./generateQuestions";

/**
 * §4: "After the first draft, the system compares the questions against
 * the requirements, and any requirement with no question against it
 * comes back as a gap. It must then act on those gaps — generating the
 * missing questions — and check again." §4 also leaves the pass count to
 * us: this caps at 2 (the initial generation, already run by the caller,
 * counts as pass 1; this adds at most one gap-fill pass). A requirement
 * that fails again on the gap-fill pass stays uncovered rather than
 * looping indefinitely — Appendix A's coverage.uncovered_requirement_ids
 * exists specifically to report that honestly rather than hide it.
 */

function nextQuestionIndex(existing: Question[]): number {
  let max = 0;
  for (const q of existing) {
    const match = /^q(\d+)$/.exec(q.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max + 1;
}

export interface RunCoveragePassesResult {
  questions: Question[];
  passes: number;
  uncoveredRequirementIds: string[];
}

interface RoleContext {
  title: string;
  seniority: string;
}

export async function runCoveragePasses(
  requirements: Requirement[],
  initialQuestions: Question[],
  role: RoleContext,
  apiKey: string,
  deps: GenerateQuestionsDeps = {},
  maxPasses = 2,
): Promise<RunCoveragePassesResult> {
  let questions = initialQuestions;
  let passes = 1;

  while (passes < maxPasses) {
    const uncoveredIds = checkCoverage(requirements, questions);
    if (uncoveredIds.length === 0) break;

    const gapRequirements = requirements.filter((r) => uncoveredIds.includes(r.id));
    const startIndex = nextQuestionIndex(questions);
    const gapResult = await generateAllQuestions(gapRequirements, role, apiKey, deps, { startIndex });

    questions = [...questions, ...gapResult.questions];
    passes++;
  }

  return {
    questions,
    passes,
    uncoveredRequirementIds: checkCoverage(requirements, questions),
  };
}
