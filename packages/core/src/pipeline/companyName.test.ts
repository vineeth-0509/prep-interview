import { describe, expect, it } from "vitest";
import { guessCompanyName } from "./companyName";

describe("guessCompanyName", () => {
  it("capitalizes a simple domain label", () => {
    expect(guessCompanyName("https://acme.com")).toBe("Acme");
  });

  it("strips a leading www.", () => {
    expect(guessCompanyName("https://www.acme.com")).toBe("Acme");
  });

  it("title-cases hyphenated domains", () => {
    expect(guessCompanyName("https://my-startup.io")).toBe("My Startup");
  });

  it("falls back to the raw input on an unparseable URL", () => {
    expect(guessCompanyName("not-a-url")).toBe("not-a-url");
  });
});
