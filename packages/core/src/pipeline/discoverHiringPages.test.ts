import { describe, expect, it } from "vitest";
import { discoverHiringPages, isSameSite, scoreLink } from "./discoverHiringPages";
import type { FetchResult } from "./fetchPage";

describe("scoreLink", () => {
  it("scores a careers-path link higher than an unrelated one", () => {
    expect(scoreLink("https://acme.com/careers", "Careers")).toBeGreaterThan(
      scoreLink("https://acme.com/products", "Products"),
    );
  });

  it("credits both path and anchor text keyword matches", () => {
    const pathAndAnchor = scoreLink("https://acme.com/jobs", "Open jobs");
    const pathOnly = scoreLink("https://acme.com/jobs", "Learn more");
    expect(pathAndAnchor).toBeGreaterThan(pathOnly);
  });
});

describe("isSameSite", () => {
  it("matches identical hostnames", () => {
    expect(isSameSite("https://acme.com/a", "https://acme.com/b")).toBe(true);
  });

  it("rejects a different hostname", () => {
    expect(isSameSite("https://acme.com/a", "https://other.com/b")).toBe(false);
  });
});

describe("discoverHiringPages", () => {
  // A tiny fixture "site": homepage links to /careers (high score) and
  // /products (low score); /careers links to /careers/interview-process.
  const fixture: Record<string, FetchResult> = {
    "https://acme.test/": {
      ok: true,
      url: "https://acme.test/",
      title: "Acme",
      text: "Welcome to Acme",
      bytes: 100,
      links: [
        { url: "https://acme.test/careers", anchorText: "Careers" },
        { url: "https://acme.test/products", anchorText: "Products" },
        { url: "https://external.test/blog", anchorText: "External blog" },
      ],
    },
    "https://acme.test/careers": {
      ok: true,
      url: "https://acme.test/careers",
      title: "Careers at Acme",
      text: "We are hiring",
      bytes: 100,
      links: [
        {
          url: "https://acme.test/careers/interview-process",
          anchorText: "Our interview process",
        },
      ],
    },
    "https://acme.test/products": {
      ok: true,
      url: "https://acme.test/products",
      title: "Products",
      text: "Our products",
      bytes: 100,
      links: [],
    },
    "https://acme.test/careers/interview-process": {
      ok: true,
      url: "https://acme.test/careers/interview-process",
      title: "Our Interview Process",
      text: "Two rounds: a take-home and a system design interview.",
      bytes: 100,
      links: [],
    },
  };

  const fakeFetchPage = async (url: string): Promise<FetchResult> =>
    fixture[url] ?? { ok: false, url, reason: "not_in_fixture" };

  it("finds the deep hiring-process page within the page budget", async () => {
    const result = await discoverHiringPages(
      "https://acme.test/",
      { maxDepth: 2, maxPages: 15 },
      { fetchPageFn: fakeFetchPage },
    );
    const urls = result.pages.map((p) => p.url);
    expect(urls).toContain("https://acme.test/careers/interview-process");
  });

  it("never crawls an external-site link", async () => {
    const result = await discoverHiringPages(
      "https://acme.test/",
      { maxDepth: 2, maxPages: 15 },
      { fetchPageFn: fakeFetchPage },
    );
    const urls = result.pages.map((p) => p.url);
    expect(urls.some((u) => u.includes("external.test"))).toBe(false);
  });

  it("respects maxDepth — a depth-2 link is dropped when maxDepth is 1", async () => {
    const result = await discoverHiringPages(
      "https://acme.test/",
      { maxDepth: 1, maxPages: 15 },
      { fetchPageFn: fakeFetchPage },
    );
    const urls = result.pages.map((p) => p.url);
    expect(urls).not.toContain("https://acme.test/careers/interview-process");
  });

  it("records a fetch failure as skipped rather than throwing", async () => {
    const flaky = async (url: string): Promise<FetchResult> => {
      if (url === "https://acme.test/careers") {
        return { ok: false, url, reason: "timeout" };
      }
      return fakeFetchPage(url);
    };
    const result = await discoverHiringPages(
      "https://acme.test/",
      { maxDepth: 2, maxPages: 15 },
      { fetchPageFn: flaky },
    );
    expect(result.skipped.some((s) => s.url === "https://acme.test/careers")).toBe(
      true,
    );
    // the crawl continues to other pages rather than aborting
    expect(result.pages.length).toBeGreaterThan(0);
  });

  it("never exceeds the page budget", async () => {
    const result = await discoverHiringPages(
      "https://acme.test/",
      { maxDepth: 2, maxPages: 2 },
      { fetchPageFn: fakeFetchPage },
    );
    expect(result.pages.length).toBeLessThanOrEqual(2);
  });
});
