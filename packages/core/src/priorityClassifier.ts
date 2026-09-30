import type { RequirementPriority } from "./types";

/**
 * Classifies a requirement's priority from the surrounding JD phrasing —
 * deterministically, in code, not left to the LLM. §4 is explicit that
 * "a 'required' line and a 'bonus points for' line are not the same
 * thing", so the pipeline's extraction step should call this against the
 * *raw source sentence* the requirement was pulled from (not the LLM's
 * paraphrased requirement.text), then attach the result as the
 * requirement's `priority` field.
 *
 * Nice-to-have phrasing is checked first and wins on conflict — e.g.
 * "5+ years experience (nice to have)" contains both a strong must-like
 * signal (a years-of-experience pattern) and an explicit nice-to-have
 * disclaimer; the explicit phrasing should override the generic
 * heuristic. If nothing matches either list, the result defaults to
 * "nice" — per §4, "if ambiguous, default to nice (never invent
 * urgency)".
 */

const NICE_PATTERNS: RegExp[] = [
  /\bnice[- ]to[- ]have\b/i,
  /\bbonus( points)?\b/i,
  /\ba\s+plus\b/i,
  /\bpreferred\b/i,
  /\bideally\b/i,
  /\badvantageous\b/i,
  /\bdesirable\b/i,
  /\bgood to have\b/i,
  /\bwould be great\b/i,
];

const MUST_PATTERNS: RegExp[] = [
  /\brequired\b/i,
  /\bmust[- ]?have\b/i,
  /\brequires?\b/i,
  /\bessential\b/i,
  /\bmandatory\b/i,
  /\bminimum of\b/i,
  /\bat least\b/i,
  /\b\d+\+?\s*(?:-\s*\d+\s*)?\s*years?\b/i, // "5+ years", "3-5 years", "5 years"
  /\byou must\b/i,
];

export function classifyPriority(sourcePhrase: string): RequirementPriority {
  const text = sourcePhrase ?? "";
  if (NICE_PATTERNS.some((p) => p.test(text))) return "nice";
  if (MUST_PATTERNS.some((p) => p.test(text))) return "must";
  return "nice"; // ambiguous default — never invent urgency
}
