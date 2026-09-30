import type {
  Question,
  QuestionCategory,
  Requirement,
  RequirementPriority,
  Schedule,
  ScheduleDay,
} from "./types";

/**
 * Deterministic schedule builder (§8). This is arithmetic and allocation,
 * explicitly called out in the brief as something that "belongs in your
 * code, not in a prompt" — no LLM call happens anywhere in this file.
 *
 * Algorithm, agreed with the candidate before writing this:
 *
 * 1. Rank every question by (must-have first, then hardest first). A
 *    question's effective priority is "must" if ANY requirement it
 *    covers is a must-have, even if it also covers a nice-to-have —
 *    dropping it would leave that must-have requirement unscheduled.
 *
 * 2. Give each day a minute budget on a linearly decreasing scale
 *    (day 1 gets DAY_CAPACITY_MAX_MINUTES, the last day gets
 *    DAY_CAPACITY_MIN_MINUTES, interpolated in between). This is what
 *    produces the front-loading: harder/must material is ranked first
 *    and days are filled in order, so it lands in the roomier early days.
 *
 * 3. Fill days in order from the ranked list. A day accepts a question
 *    if it still has budget, or unconditionally if the day is currently
 *    empty (so one oversized item never stalls a day at zero items).
 *    If the LAST day is full and a must-have question still doesn't fit,
 *    it goes in anyway (budget overflow) — must-haves are never dropped.
 *    A nice-to-have that doesn't fit anywhere is dropped from the
 *    schedule (it remains in the kit's question bank).
 *
 * 4. If days remain after every question has been placed once (e.g. a
 *    60-day request against a thin JD), the leftover days get spaced
 *    review: must-have question ids are re-referenced on later days,
 *    rotating the starting point per day so the tail isn't a verbatim
 *    repeat of the same handful of ids every day.
 */

export const MINUTES_BY_DIFFICULTY: Record<1 | 2 | 3, number> = {
  1: 10,
  2: 15,
  3: 25,
};

export const DAY_CAPACITY_MAX_MINUTES = 120;
export const DAY_CAPACITY_MIN_MINUTES = 45;

const CATEGORY_LABELS: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

function estimateMinutes(question: Question): number {
  return MINUTES_BY_DIFFICULTY[question.difficulty];
}

function effectivePriority(
  question: Question,
  priorityById: Map<string, RequirementPriority>,
): RequirementPriority {
  for (const rid of question.requirement_ids) {
    if (priorityById.get(rid) === "must") return "must";
  }
  return "nice";
}

/** Exported for testing: the per-day minute budget, day 1 largest. */
export function computeDayCapacities(daysAvailable: number): number[] {
  const n = Math.max(1, Math.floor(daysAvailable));
  if (n === 1) return [DAY_CAPACITY_MAX_MINUTES];
  const caps: number[] = [];
  const span = DAY_CAPACITY_MAX_MINUTES - DAY_CAPACITY_MIN_MINUTES;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1); // 0 on day 1, 1 on the last day
    caps.push(Math.round(DAY_CAPACITY_MAX_MINUTES - t * span));
  }
  return caps;
}

function focusFor(ids: string[], byId: Map<string, Question>): string {
  if (ids.length === 0) return "No material available";
  const counts = new Map<QuestionCategory, number>();
  for (const id of ids) {
    const q = byId.get(id);
    if (!q) continue;
    counts.set(q.category, (counts.get(q.category) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return "Review";
  if (sorted.length === 1) return CATEGORY_LABELS[sorted[0][0]];
  if (sorted.length === 2) {
    return `${CATEGORY_LABELS[sorted[0][0]]} & ${CATEGORY_LABELS[sorted[1][0]]}`;
  }
  return "Mixed prep";
}

export function buildSchedule(
  requirements: Requirement[],
  questions: Question[],
  daysAvailable: number,
): Schedule {
  const n = Math.max(1, Math.floor(daysAvailable));
  const priorityById = new Map(requirements.map((r) => [r.id, r.priority]));
  const questionById = new Map(questions.map((q) => [q.id, q]));

  const ranked = [...questions].sort((a, b) => {
    const pa = effectivePriority(a, priorityById) === "must" ? 0 : 1;
    const pb = effectivePriority(b, priorityById) === "must" ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return b.difficulty - a.difficulty; // harder first within the same priority
  });

  const capacities = computeDayCapacities(n);
  const dayIds: string[][] = Array.from({ length: n }, () => []);
  const dayUsed: number[] = new Array(n).fill(0);

  let day = 0;
  for (const q of ranked) {
    const est = estimateMinutes(q);
    const isMust = effectivePriority(q, priorityById) === "must";

    // Move on from days that already have content and no room left.
    while (
      day < n - 1 &&
      dayIds[day].length > 0 &&
      dayUsed[day] + est > capacities[day]
    ) {
      day++;
    }

    const overflowsLastDay =
      day === n - 1 &&
      dayIds[day].length > 0 &&
      dayUsed[day] + est > capacities[day];

    if (overflowsLastDay) {
      if (isMust) {
        // Must-haves are never dropped, even if it means exceeding the
        // last day's budget.
        dayIds[day].push(q.id);
        dayUsed[day] += est;
      }
      // A nice-to-have that doesn't fit anywhere is dropped from the
      // schedule; it still exists in the kit's question bank.
      continue;
    }

    dayIds[day].push(q.id);
    dayUsed[day] += est;
  }

  // Leftover days (more days requested than there was content to fill):
  // spaced review of must-have material, rotating the start point so
  // consecutive review days don't just repeat the same slice verbatim.
  const lastContentDay = dayIds.reduce(
    (max, ids, idx) => (ids.length > 0 ? idx : max),
    -1,
  );
  const reviewDayIndices = new Set<number>();
  if (lastContentDay < n - 1) {
    const mustIds = ranked
      .filter((q) => effectivePriority(q, priorityById) === "must")
      .map((q) => q.id);
    const pool = mustIds.length > 0 ? mustIds : ranked.map((q) => q.id);

    if (pool.length > 0) {
      let offset = 0;
      for (let d = lastContentDay + 1; d < n; d++) {
        const cap = capacities[d];
        const selected: string[] = [];
        let used = 0;
        for (let k = 0; k < pool.length; k++) {
          const qid = pool[(offset + k) % pool.length];
          const est = estimateMinutes(questionById.get(qid)!);
          if (used === 0 || used + est <= cap) {
            selected.push(qid);
            used += est;
          } else {
            break;
          }
        }
        dayIds[d] = selected;
        dayUsed[d] = used;
        reviewDayIndices.add(d);
        offset = (offset + Math.max(1, selected.length)) % pool.length;
      }
    }
  }

  const days: ScheduleDay[] = dayIds.map((ids, idx) => ({
    day: idx + 1,
    focus: reviewDayIndices.has(idx)
      ? ids.length > 0
        ? "Spaced review"
        : "No material available"
      : focusFor(ids, questionById),
    question_ids: ids,
    minutes: dayUsed[idx],
  }));

  return { days_available: n, days };
}
