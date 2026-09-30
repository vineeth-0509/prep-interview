import { describe, expect, it } from "vitest";
import { fetchPublicDiscussion } from "./fetchPublicDiscussion";
import type { FetchResult } from "./fetchPage";
import type { SerperResult } from "./fetchPublicDiscussion";

const page = (url: string, text: string): FetchResult => ({
  ok: true,
  url,
  title: "Discussion",
  text,
  bytes: 100,
  links: [],
});

describe("fetchPublicDiscussion", () => {
  it("returns found:true with sources when search and fetch succeed", async () => {
    const result = await fetchPublicDiscussion(
      "Acme Corp",
      "fake-key",
      {},
      {
        searchFn: async (): Promise<SerperResult[]> => [
          { title: "Acme interview review", link: "https://glassdoor.com/acme", snippet: "..." },
        ],
        fetchPageFn: async (url) => page(url, "Two rounds: take-home then system design."),
      },
    );

    expect(result.found).toBe(true);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe("https://glassdoor.com/acme");
  });

  it("returns found:false when every query comes back empty", async () => {
    const result = await fetchPublicDiscussion(
      "Totally Obscure Startup",
      "fake-key",
      {},
      { searchFn: async () => [] },
    );
    expect(result.found).toBe(false);
    expect(result.sources).toHaveLength(0);
  });

  it("continues past a failing query instead of aborting the whole step", async () => {
    let calls = 0;
    const result = await fetchPublicDiscussion(
      "Acme Corp",
      "fake-key",
      {},
      {
        searchFn: async () => {
          calls++;
          if (calls === 1) throw new Error("provider down");
          return [{ title: "Acme review", link: "https://reddit.com/acme", snippet: "..." }];
        },
        fetchPageFn: async (url) => page(url, "Discussion text"),
      },
    );
    expect(calls).toBeGreaterThan(1);
    expect(result.found).toBe(true);
  });

  it("dedupes the same link surfaced by multiple queries", async () => {
    let fetchCalls = 0;
    const result = await fetchPublicDiscussion(
      "Acme Corp",
      "fake-key",
      {},
      {
        searchFn: async (): Promise<SerperResult[]> => [
          { title: "Acme review", link: "https://glassdoor.com/acme", snippet: "..." },
        ],
        fetchPageFn: async (url) => {
          fetchCalls++;
          return page(url, "Discussion text");
        },
      },
    );
    expect(result.sources).toHaveLength(1);
    expect(fetchCalls).toBe(1);
  });

  it("records a fetch failure as skipped without throwing", async () => {
    const result = await fetchPublicDiscussion(
      "Acme Corp",
      "fake-key",
      {},
      {
        searchFn: async (): Promise<SerperResult[]> => [
          { title: "Acme review", link: "https://dead-link.example/acme", snippet: "..." },
        ],
        fetchPageFn: async (url) => ({ ok: false, url, reason: "timeout" }),
      },
    );
    expect(result.found).toBe(false);
    expect(result.skipped).toEqual([{ url: "https://dead-link.example/acme", reason: "timeout" }]);
  });
});
