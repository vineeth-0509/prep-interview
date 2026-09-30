import { describe, expect, it } from "vitest";
import { validateKit } from "./schema";
import { makeValidKit } from "./__fixtures__/kit";

describe("validateKit", () => {
  it("accepts a well-formed kit", () => {
    const result = validateKit(makeValidKit());
    expect(result.valid).toBe(true);
  });

  it("rejects a kit missing a required field", () => {
    const kit = makeValidKit();
    // @ts-expect-error deliberately breaking the shape for the test
    delete kit.company_brief.summary;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.path === "company_brief.summary")).toBe(
        true,
      );
    }
  });

  it("rejects non-integer minutes", () => {
    const kit = makeValidKit();
    kit.schedule.days[0].minutes = 15.5;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });

  it("rejects a question referencing a nonexistent requirement id", () => {
    const kit = makeValidKit();
    kit.questions[0].requirement_ids = ["does-not-exist"];
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) =>
          e.message.includes('unknown requirement id "does-not-exist"'),
        ),
      ).toBe(true);
    }
  });

  it("rejects a schedule day referencing a nonexistent question id", () => {
    const kit = makeValidKit();
    kit.schedule.days[0].question_ids = ["does-not-exist"];
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(
        result.errors.some((e) =>
          e.message.includes('unknown question id "does-not-exist"'),
        ),
      ).toBe(true);
    }
  });

  it("rejects a schedule whose day count doesn't match days_available", () => {
    const kit = makeValidKit();
    kit.schedule.days_available = 5;
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });

  it("rejects duplicate requirement ids", () => {
    const kit = makeValidKit();
    kit.role.requirements[1].id = "r1";
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
  });

  it("accepts an item carrying a §7 meta block", () => {
    const kit = makeValidKit();
    kit.questions[0].meta = {
      source: "user_edited",
      pinned: true,
      version: 2,
    };
    const result = validateKit(kit);
    expect(result.valid).toBe(true);
  });
});
