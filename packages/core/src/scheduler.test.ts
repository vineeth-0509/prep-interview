import { describe, expect, it } from "vitest";
import {
  DAY_CAPACITY_MAX_MINUTES,
  DAY_CAPACITY_MIN_MINUTES,
  buildSchedule,
  computeDayCapacities,
} from "./scheduler";
import type { Question, Requirement } from "./types";

const req = (id: string, priority: "must" | "nice" = "must"): Requirement => ({
  id,
  text: `requirement ${id}`,
  kind: "technical",
  priority,
});

const q = (
  id: string,
  requirement_ids: string[],
  difficulty: 1 | 2 | 3 = 2,
  category: Question["category"] = "technical",
): Question => ({
  id,
  requirement_ids,
  category,
  prompt: "",
  answer_outline: "",
  difficulty,
});

describe("computeDayCapacities", () => {
  it("gives a single day the max budget", () => {
    expect(computeDayCapacities(1)).toEqual([DAY_CAPACITY_MAX_MINUTES]);
  });

  it("decreases from day 1 to the last day", () => {
    const caps = computeDayCapacities(5);
    expect(caps).toHaveLength(5);
    expect(caps[0]).toBe(DAY_CAPACITY_MAX_MINUTES);
    expect(caps[caps.length - 1]).toBe(DAY_CAPACITY_MIN_MINUTES);
    for (let i = 1; i < caps.length; i++) {
      expect(caps[i]).toBeLessThanOrEqual(caps[i - 1]);
    }
  });
});

describe("buildSchedule", () => {
  it("spans exactly the number of days requested", () => {
    const requirements = [req("r1")];
    const questions = [q("q1", ["r1"])];
    const schedule = buildSchedule(requirements, questions, 5);
    expect(schedule.days_available).toBe(5);
    expect(schedule.days).toHaveLength(5);
    expect(schedule.days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts every must-have requirement's question somewhere in the schedule", () => {
    const requirements = [req("r1"), req("r2"), req("r3", "nice")];
    const questions = [
      q("q1", ["r1"]),
      q("q2", ["r2"]),
      q("q3", ["r3"]),
    ];
    const schedule = buildSchedule(requirements, questions, 3);
    const scheduled = new Set(schedule.days.flatMap((d) => d.question_ids));
    expect(scheduled.has("q1")).toBe(true);
    expect(scheduled.has("q2")).toBe(true);
  });

  it("front-loads harder and must-have material onto earlier days", () => {
    const requirements = [req("r1"), req("r2", "nice")];
    const questions = [
      q("must-hard", ["r1"], 3),
      q("nice-easy", ["r2"], 1),
    ];
    const schedule = buildSchedule(requirements, questions, 2);
    expect(schedule.days[0].question_ids).toContain("must-hard");
  });

  it("1-day compression: includes every must-have even past the day's budget", () => {
    // Ten hard must-have questions comfortably exceed a single day's
    // 120-minute budget (10 * 25 = 250 minutes) — all of them must still
    // appear, per §8/§10's 1-day edge case.
    const requirements = Array.from({ length: 10 }, (_, i) => req(`r${i}`));
    const questions = requirements.map((r, i) => q(`q${i}`, [r.id], 3));
    const schedule = buildSchedule(requirements, questions, 1);

    expect(schedule.days).toHaveLength(1);
    expect(schedule.days[0].question_ids).toHaveLength(10);
    expect(schedule.days[0].minutes).toBe(250);
  });

  it("1-day compression: may drop nice-to-haves that don't fit", () => {
    const requirements = [
      ...Array.from({ length: 8 }, (_, i) => req(`must${i}`)),
      req("nice0", "nice"),
    ];
    const questions = [
      ...requirements
        .filter((r) => r.priority === "must")
        .map((r, i) => q(`qm${i}`, [r.id], 3)),
      q("qn0", ["nice0"], 3),
    ];
    const schedule = buildSchedule(requirements, questions, 1);
    const scheduled = new Set(schedule.days[0].question_ids);
    // every must-have is present
    for (let i = 0; i < 8; i++) expect(scheduled.has(`qm${i}`)).toBe(true);
  });

  it("60-day spread: fills every day, using spaced review once content runs out", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    const schedule = buildSchedule(requirements, questions, 60);

    expect(schedule.days).toHaveLength(60);
    // no day should be entirely empty when must-have material exists to review
    for (const d of schedule.days) {
      expect(d.question_ids.length).toBeGreaterThan(0);
    }
    // later days are marked as review, not fresh content
    const lastDay = schedule.days[schedule.days.length - 1];
    expect(lastDay.focus).toBe("Spaced review");
  });

  it("every question_ids entry in the schedule refers to a real question", () => {
    const requirements = [req("r1"), req("r2")];
    const questions = [q("q1", ["r1"]), q("q2", ["r2"])];
    const schedule = buildSchedule(requirements, questions, 10);
    const validIds = new Set(questions.map((qq) => qq.id));
    for (const day of schedule.days) {
      for (const id of day.question_ids) {
        expect(validIds.has(id)).toBe(true);
      }
    }
  });

  it("minutes are always non-negative integers", () => {
    const requirements = [req("r1")];
    const questions = [q("q1", ["r1"], 2)];
    const schedule = buildSchedule(requirements, questions, 7);
    for (const day of schedule.days) {
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThanOrEqual(0);
    }
  });
});
