import { createHash } from "node:crypto";

/**
 * §9/§10: "same JD + company submitted twice" should be detected and
 * short-circuited rather than silently re-running the full pipeline and
 * burning LLM/search quota. Normalizing whitespace and casing on the URL
 * before hashing means trivial differences (trailing slash, protocol
 * case) don't defeat the dedupe check.
 */
export function computeContentHash(jdText: string, companyUrl: string): string {
  const normalizedJd = jdText.trim().replace(/\s+/g, " ");
  const normalizedUrl = companyUrl.trim().toLowerCase().replace(/\/+$/, "");
  return createHash("sha256")
    .update(normalizedJd)
    .update("\u0000")
    .update(normalizedUrl)
    .digest("hex");
}
