import { AbortError, withRetry } from "./retry";
import { fetchPage } from "./fetchPage";

/**
 * §6.2 step 3: search for public discussion of the company's interview
 * process, then retrieve+clean the top results through the same
 * fetchPage path as the crawler (§6.2 step 2) — no separate retrieval
 * logic. Uses Serper (free grant, no credit card, no billing surface —
 * see the earlier search-API discussion).
 *
 * If nothing turns up across every query, `found: false` is returned
 * rather than an error — §6.2/§10 are explicit that this is a real,
 * expected case to be recorded honestly in company_brief, not a failure.
 */

export interface SerperResult {
  title: string;
  link: string;
  snippet: string;
}

const SERPER_ENDPOINT = "https://google.serper.dev/search";

export async function searchSerper(query: string, apiKey: string): Promise<SerperResult[]> {
  return withRetry(
    async () => {
      const res = await fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ q: query }),
      });

      if (res.status === 429 || res.status >= 500) {
        throw new Error(`Serper transient error (status ${res.status})`);
      }
      if (!res.ok) {
        throw new AbortError(`Serper request failed (status ${res.status})`);
      }

      const data = (await res.json()) as {
        organic?: Array<{ title: string; link: string; snippet?: string }>;
      };
      return (data.organic ?? []).map((r) => ({
        title: r.title,
        link: r.link,
        snippet: r.snippet ?? "",
      }));
    },
    { retries: 4 },
  );
}

function buildQueries(companyName: string): string[] {
  return [
    `${companyName} interview process`,
    `${companyName} interview questions site:glassdoor.com`,
    `${companyName} interview experience site:reddit.com`,
    `${companyName} interview site:teamblind.com`,
  ];
}

export interface DiscussionSource {
  url: string;
  title: string;
  text: string;
  snippet: string;
}

export interface FetchPublicDiscussionResult {
  sources: DiscussionSource[];
  skipped: Array<{ url: string; reason: string }>;
  queriesUsed: string[];
  found: boolean;
}

export interface FetchPublicDiscussionOptions {
  allowLocal?: boolean;
}

export interface FetchPublicDiscussionDeps {
  searchFn?: (query: string, apiKey: string) => Promise<SerperResult[]>;
  fetchPageFn?: typeof fetchPage;
}

const RESULTS_PER_QUERY = 3;
const MAX_SOURCES = 5;

export async function fetchPublicDiscussion(
  companyName: string,
  apiKey: string,
  options: FetchPublicDiscussionOptions = {},
  deps: FetchPublicDiscussionDeps = {},
): Promise<FetchPublicDiscussionResult> {
  const doSearch = deps.searchFn ?? searchSerper;
  const doFetch = deps.fetchPageFn ?? fetchPage;
  const queries = buildQueries(companyName);

  // Dedupe candidate links across queries — Glassdoor/Reddit/Blind
  // queries often surface the same page more than once.
  const candidates = new Map<string, SerperResult>();
  for (const query of queries) {
    let results: SerperResult[] = [];
    try {
      results = await doSearch(query, apiKey);
    } catch {
      // One bad query shouldn't sink the whole step — try the rest.
      continue;
    }
    for (const r of results.slice(0, RESULTS_PER_QUERY)) {
      if (!candidates.has(r.link)) candidates.set(r.link, r);
    }
  }

  const sources: DiscussionSource[] = [];
  const skipped: Array<{ url: string; reason: string }> = [];

  for (const [url, result] of candidates) {
    if (sources.length >= MAX_SOURCES) break;
    const fetched = await doFetch(url, { allowLocal: options.allowLocal });
    if (fetched.ok) {
      sources.push({
        url: fetched.url,
        title: fetched.title || result.title,
        text: fetched.text,
        snippet: result.snippet,
      });
    } else {
      skipped.push({ url, reason: fetched.reason });
    }
  }

  return { sources, skipped, queriesUsed: queries, found: sources.length > 0 };
}
