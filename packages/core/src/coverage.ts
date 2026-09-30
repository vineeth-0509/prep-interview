import type { Coverage, Question, Requirement } from "./types";

/**
 * Returns the ids of every requirement that no question currently covers.
 *
 * This is deliberately a pure, dependency-free function: the brief is
 * explicit that this comparison is "your code's decision to make, not the
 * model's" (§3), and it's one of the two steps the brief calls out as
 * non-negotiably deterministic (the other being the scheduler, §8).
 *
 * Handles the zero-requirement and zero-question edge cases named in
 * §14 naturally: an empty requirements list has nothing to be uncovered,
 * and an empty questions list covers nothing, so every requirement (if
 * any) comes back uncovered.
 */
export function checkCoverage(
  requirements: Requirement[],
  questions: Question[],
): string[] {
  const covered = new Set<string>();
  for (const question of questions) {
    for (const requirementId of question.requirement_ids) {
      covered.add(requirementId);
    }
  }
  return requirements
    .filter((requirement) => !covered.has(requirement.id))
    .map((requirement) => requirement.id);
}

/**
 * Builds the Kit's `coverage` field: the current uncovered list plus the
 * number of generation passes taken so far. `passes` is tracked by the
 * pipeline orchestrator (§6.2 step 8 caps it at 2 — initial + one
 * gap-fill) and threaded through here rather than computed by this
 * function, since "how many passes have run" isn't something coverage
 * itself can know.
 */
export function buildCoverage(
  requirements: Requirement[],
  questions: Question[],
  passes: number,
): Coverage {
  return {
    uncovered_requirement_ids: checkCoverage(requirements, questions),
    passes,
  };
}

/**
 * True once every requirement has at least one question against it —
 * the condition the brief calls a hard failure if unmet: "a kit that
 * ships with uncovered must-have requirements has failed at the one job
 * it had" (§4). Note this checks *all* requirements, not only `must`
 * ones — coverage.uncovered_requirement_ids is defined over every
 * requirement id, and it's the schedule (§8) that treats must vs. nice
 * differently, not the coverage check.
 */
export function isFullyCovered(
  requirements: Requirement[],
  questions: Question[],
): boolean {
  return checkCoverage(requirements, questions).length === 0;
}
