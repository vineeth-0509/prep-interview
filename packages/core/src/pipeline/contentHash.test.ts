import { describe, expect, it } from "vitest";
import { computeContentHash } from "./contentHash";

describe("computeContentHash", () => {
  it("is stable for identical input", () => {
    const a = computeContentHash("Senior Engineer JD", "https://acme.com");
    const b = computeContentHash("Senior Engineer JD", "https://acme.com");
    expect(a).toBe(b);
  });

  it("ignores trailing slashes and url casing", () => {
    const a = computeContentHash("Senior Engineer JD", "https://acme.com/");
    const b = computeContentHash("Senior Engineer JD", "HTTPS://ACME.COM");
    expect(a).toBe(b);
  });

  it("ignores incidental whitespace differences in the JD", () => {
    const a = computeContentHash("Senior  Engineer\nJD", "https://acme.com");
    const b = computeContentHash("Senior Engineer JD", "https://acme.com");
    expect(a).toBe(b);
  });

  it("differs when the JD text differs", () => {
    const a = computeContentHash("Senior Engineer JD", "https://acme.com");
    const b = computeContentHash("Staff Engineer JD", "https://acme.com");
    expect(a).not.toBe(b);
  });

  it("differs when the company url differs", () => {
    const a = computeContentHash("Senior Engineer JD", "https://acme.com");
    const b = computeContentHash("Senior Engineer JD", "https://other.com");
    expect(a).not.toBe(b);
  });
});
