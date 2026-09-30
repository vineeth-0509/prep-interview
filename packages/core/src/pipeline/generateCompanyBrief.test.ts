import { describe, expect, it } from "vitest";
import { CompanyBriefValidationError, generateCompanyBrief } from "./generateCompanyBrief";

describe("generateCompanyBrief", () => {
  it("skips the LLM call entirely and is honest when nothing was retrieved", async () => {
    let called = false;
    const brief = await generateCompanyBrief("Acme Corp", [], [], "fake-key", {
      callModel: async () => {
        called = true;
        return {};
      },
    });
    expect(called).toBe(false);
    expect(brief.sources).toEqual([]);
    expect(brief.summary.toLowerCase()).toContain("no public information");
  });

  it("only cites URLs that were actually part of the input", async () => {
    const brief = await generateCompanyBrief(
      "Acme Corp",
      [{ url: "https://acme.com/about", title: "About", text: "We build widgets." }],
      [],
      "fake-key",
      {
        callModel: async () => ({
          summary: "Acme builds widgets.",
          what_they_do: "B2B widget SaaS.",
          cited_urls: ["https://acme.com/about", "https://hallucinated.example/fake"],
        }),
      },
    );
    expect(brief.sources).toEqual(["https://acme.com/about"]);
  });

  it("falls back to the real input sources if the model cites none", async () => {
    const brief = await generateCompanyBrief(
      "Acme Corp",
      [{ url: "https://acme.com/about", title: "About", text: "We build widgets." }],
      [],
      "fake-key",
      {
        callModel: async () => ({
          summary: "Acme builds widgets.",
          what_they_do: "B2B widget SaaS.",
          cited_urls: [],
        }),
      },
    );
    expect(brief.sources).toEqual(["https://acme.com/about"]);
  });

  it("throws after exhausting attempts on a malformed response", async () => {
    await expect(
      generateCompanyBrief(
        "Acme Corp",
        [{ url: "https://acme.com/about", title: "About", text: "We build widgets." }],
        [],
        "fake-key",
        { callModel: async () => ({ nonsense: true }) },
      ),
    ).rejects.toThrow(CompanyBriefValidationError);
  });
});
