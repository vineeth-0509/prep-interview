/**
 * §11: "Never interpolate fetched content directly into a system prompt
 * as instructions — always pass it as clearly delimited data within a
 * user-message payload... Strip or flag content that resembles
 * prompt-override attempts before it reaches the model."
 *
 * Both the pasted JD and every crawled page are untrusted text, so every
 * pipeline step that hands external text to the model routes it through
 * wrapUntrustedContent first. Suspicious phrases are flagged in place
 * (not silently deleted) — deletion risks quietly dropping a company
 * page's legitimate discussion of something that happens to match a
 * pattern; flagging keeps the text but breaks its imperative form and
 * makes it visibly suspicious to the model, which is instructed
 * separately to treat the whole block as data regardless.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any )?(previous|prior|above|earlier) instructions?/gi,
  /disregard (all |any )?(previous|prior|above|earlier) instructions?/gi,
  /forget (all |any )?(previous|prior|above|earlier) instructions?/gi,
  /you are now (a|an)\s/gi,
  /pretend (that )?you are\s/gi,
  /new system prompt/gi,
  /\bsystem\s*:\s*override/gi,
];

export function flagSuspiciousInstructions(text: string): string {
  return INJECTION_PATTERNS.reduce(
    (acc, pattern) => acc.replace(pattern, (match) => `[flagged-text: "${match.trim()}"]`),
    text,
  );
}

export function wrapUntrustedContent(label: string, content: string): string {
  const flagged = flagSuspiciousInstructions(content);
  return `<untrusted_content source="${label}">\n${flagged}\n</untrusted_content>`;
}
