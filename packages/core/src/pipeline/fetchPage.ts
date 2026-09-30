import * as cheerio from "cheerio";
import { assertSafeUrl, UnsafeUrlError } from "../security/urlSafety";
import { AbortError, withRetry } from "./retry";

/**
 * §6.2 step 2's "retrieve and clean an individual page", built once and
 * reused by both the crawler and the public-discussion fetch step (§6.2
 * step 3) rather than duplicated. Never throws for an ordinary fetch
 * failure — §6.2/§10 are explicit that one dead page should be recorded
 * as skipped, not fail the whole run, so callers always get a result
 * back and decide what to do with it.
 */

export interface FetchedPage {
  ok: true;
  url: string;
  title: string;
  text: string;
  bytes: number;
  links: Array<{ url: string; anchorText: string }>;
}

export interface SkippedPage {
  ok: false;
  url: string;
  reason: string;
}

export type FetchResult = FetchedPage | SkippedPage;

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024; // 2MB, per §6.2 step 2
const DEFAULT_TIMEOUT_MS = 10_000;
const USER_AGENT = "AIInterviewPrepKitBot/1.0 (+research)";

export interface FetchPageOptions {
  allowLocal?: boolean;
  maxBytes?: number;
  timeoutMs?: number;
}

export async function fetchPage(
  rawUrl: string,
  options: FetchPageOptions = {},
): Promise<FetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let safeUrl: URL;
  try {
    safeUrl = await assertSafeUrl(rawUrl, { allowLocal: options.allowLocal });
  } catch (err) {
    if (err instanceof UnsafeUrlError) {
      return { ok: false, url: rawUrl, reason: err.message };
    }
    return { ok: false, url: rawUrl, reason: "url_validation_failed" };
  }

  try {
    const { html, bytes } = await withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        try {
          const res = await fetch(safeUrl.toString(), {
            signal: controller.signal,
            headers: { "User-Agent": USER_AGENT },
            redirect: "follow",
          });

          if (res.status === 404 || res.status === 410) {
            // Not found/gone — retrying won't help.
            throw new AbortError(`Not found (status ${res.status})`);
          }
          if (res.status === 429 || res.status >= 500) {
            throw new Error(`Transient error (status ${res.status})`);
          }
          if (!res.ok) {
            throw new AbortError(`Request failed (status ${res.status})`);
          }

          const contentType = res.headers.get("content-type") ?? "";
          if (!/text\/html|text\/plain/i.test(contentType)) {
            throw new AbortError(`Unsupported content type: ${contentType || "unknown"}`);
          }

          const declaredLength = Number(res.headers.get("content-length") ?? "0");
          if (declaredLength > maxBytes) {
            throw new AbortError(`Declared size ${declaredLength} exceeds ${maxBytes}-byte cap`);
          }

          const text = await res.text();
          const actualBytes = Buffer.byteLength(text, "utf8");
          // If the server didn't declare a length (or lied), still cap
          // what we keep — a truncated page beats none for a large but
          // otherwise-legitimate handbook/blog page.
          const truncated =
            actualBytes > maxBytes
              ? Buffer.from(text, "utf8").subarray(0, maxBytes).toString("utf8")
              : text;
          return { html: truncated, bytes: Math.min(actualBytes, maxBytes) };
        } finally {
          clearTimeout(timeout);
        }
      },
      { retries: 3 },
    );

    return cleanPage(safeUrl, html, bytes);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "fetch_failed";
    return { ok: false, url: safeUrl.toString(), reason };
  }
}

function cleanPage(pageUrl: URL, html: string, bytes: number): FetchedPage {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, footer, header, svg").remove();

  const title = $("title").first().text().trim();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  const links: Array<{ url: string; anchorText: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const resolved = new URL(href, pageUrl);
      if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;
      resolved.hash = "";
      links.push({ url: resolved.toString(), anchorText: $(el).text().trim() });
    } catch {
      // unparseable href — skip it, don't fail the whole page
    }
  });

  return { ok: true, url: pageUrl.toString(), title, text, bytes, links };
}
