import { describe, expect, it } from "vitest";
import { mergeRegeneratedList, mergeRegeneratedSchedule, mergeRegeneratedSingle } from "./regenerate";
import type { ScheduleDay } from "../types";

interface Item {
  id: string;
  meta?: { source: "generated" | "user_edited" | "user_created"; pinned: boolean; version: number };
}

const generated = (id: string): Item => ({ id, meta: { source: "generated", pinned: false, version: 0 } });
const pinned = (id: string): Item => ({ id, meta: { source: "generated", pinned: true, version: 0 } });
const userEdited = (id: string): Item => ({ id, meta: { source: "user_edited", pinned: false, version: 1 } });
const userCreated = (id: string): Item => ({ id, meta: { source: "user_created", pinned: false, version: 0 } });

describe("mergeRegeneratedList", () => {
  it("replaces untouched generated items with fresh ones", () => {
    const existing = [generated("q1"), generated("q2")];
    const fresh = [generated("q9")];
    const result = mergeRegeneratedList(existing, fresh);
    expect(result.map((i) => i.id)).toEqual(["q9"]);
  });

  it("preserves a pinned item even though it's still source:generated", () => {
    const existing = [pinned("q1"), generated("q2")];
    const fresh = [generated("q9")];
    const result = mergeRegeneratedList(existing, fresh);
    expect(result.map((i) => i.id).sort()).toEqual(["q1", "q9"]);
  });

  it("preserves a user-edited item", () => {
    const existing = [userEdited("q1"), generated("q2")];
    const fresh = [generated("q9")];
    const result = mergeRegeneratedList(existing, fresh);
    expect(result.map((i) => i.id).sort()).toEqual(["q1", "q9"]);
  });

  it("preserves a user-created item", () => {
    const existing = [userCreated("q1"), generated("q2")];
    const fresh = [generated("q9")];
    const result = mergeRegeneratedList(existing, fresh);
    expect(result.map((i) => i.id).sort()).toEqual(["q1", "q9"]);
  });

  it("treats an item with no meta at all as untouched/replaceable", () => {
    const existing: Item[] = [{ id: "q1" }];
    const fresh = [generated("q9")];
    const result = mergeRegeneratedList(existing, fresh);
    expect(result.map((i) => i.id)).toEqual(["q9"]);
  });
});

describe("mergeRegeneratedSingle", () => {
  it("replaces an untouched generated item", () => {
    expect(mergeRegeneratedSingle(generated("brief-old"), generated("brief-new")).id).toBe(
      "brief-new",
    );
  });

  it("keeps a pinned item unchanged", () => {
    expect(mergeRegeneratedSingle(pinned("brief-old"), generated("brief-new")).id).toBe(
      "brief-old",
    );
  });

  it("keeps a user-edited item unchanged", () => {
    expect(mergeRegeneratedSingle(userEdited("brief-old"), generated("brief-new")).id).toBe(
      "brief-old",
    );
  });
});

describe("mergeRegeneratedSchedule", () => {
  const day = (dayNum: number, meta?: Item["meta"]): ScheduleDay => ({
    day: dayNum,
    focus: `focus-${dayNum}`,
    question_ids: [],
    minutes: 30,
    meta,
  });

  it("takes the fresh day when the existing day is untouched", () => {
    const existing = [day(1, { source: "generated", pinned: false, version: 0 })];
    const fresh = [day(1, { source: "generated", pinned: false, version: 0 })];
    fresh[0].focus = "fresh-focus";
    const result = mergeRegeneratedSchedule(existing, fresh);
    expect(result[0].focus).toBe("fresh-focus");
  });

  it("keeps a pinned day exactly as it was, ignoring the fresh recomputation for that day number", () => {
    const existing = [day(2, { source: "generated", pinned: true, version: 0 })];
    existing[0].focus = "my custom day 2";
    const fresh = [day(2, { source: "generated", pinned: false, version: 0 })];
    fresh[0].focus = "recomputed focus";
    const result = mergeRegeneratedSchedule(existing, fresh);
    expect(result[0].focus).toBe("my custom day 2");
  });

  it("preserves a user-edited day by day number even if other days change", () => {
    const existing = [
      day(1, { source: "generated", pinned: false, version: 0 }),
      day(2, { source: "user_edited", pinned: false, version: 1 }),
    ];
    existing[1].focus = "edited day 2";
    const fresh = [
      day(1, { source: "generated", pinned: false, version: 0 }),
      day(2, { source: "generated", pinned: false, version: 0 }),
    ];
    const result = mergeRegeneratedSchedule(existing, fresh);
    expect(result.find((d) => d.day === 2)?.focus).toBe("edited day 2");
  });
});
