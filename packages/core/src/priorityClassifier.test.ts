import { describe, expect, it } from "vitest";
import { classifyPriority } from "./priorityClassifier";

describe("classifyPriority", () => {
  it("classifies explicit required phrasing as must", () => {
    expect(classifyPriority("5+ years of React required")).toBe("must");
    expect(classifyPriority("Must have strong communication skills")).toBe(
      "must",
    );
    expect(classifyPriority("Experience with Postgres is essential")).toBe(
      "must",
    );
  });

  it("classifies a bare years-of-experience phrase as must", () => {
    expect(classifyPriority("3-5 years of backend experience")).toBe("must");
  });

  it("classifies explicit bonus/nice-to-have phrasing as nice", () => {
    expect(classifyPriority("Bonus points for AWS experience")).toBe("nice");
    expect(classifyPriority("Nice to have: GraphQL")).toBe("nice");
    expect(classifyPriority("Experience with Kubernetes is a plus")).toBe(
      "nice",
    );
    expect(classifyPriority("Preferred: previous fintech experience")).toBe(
      "nice",
    );
  });

  it("lets explicit nice-to-have phrasing override a years pattern", () => {
    expect(
      classifyPriority("5+ years of Go experience (nice to have)"),
    ).toBe("nice");
  });

  it("defaults to nice when neither pattern matches (never invent urgency)", () => {
    expect(classifyPriority("Familiarity with Docker")).toBe("nice");
    expect(classifyPriority("")).toBe("nice");
  });
});
