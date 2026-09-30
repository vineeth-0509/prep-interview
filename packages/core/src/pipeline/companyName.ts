/**
 * Appendix A's `source.company` needs a display name, but nothing
 * upstream (extract_requirements, the crawl) reliably produces a clean
 * company name — a JD rarely states its own employer's name, and a
 * homepage <title> is inconsistent across sites ("Acme – Home",
 * "Welcome to Acme", etc.). Rather than spend an LLM call guessing a
 * name from noisy material, this derives it from the URL itself:
 * deterministic, free, and good enough for display purposes.
 *
 * Known limitation: this is a hostname heuristic, not real company-name
 * extraction — "acme.com" -> "Acme" works, but a site on a subdomain
 * (jobs.acme.com) or a domain that doesn't resemble the brand name will
 * produce an awkward guess. Worth calling out in the README rather than
 * silently living with it.
 */
export function guessCompanyName(companyUrl: string): string {
  let hostname: string;
  try {
    hostname = new URL(companyUrl).hostname.replace(/^www\./, "");
  } catch {
    return companyUrl;
  }
  const label = hostname.split(".")[0] || hostname;
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
