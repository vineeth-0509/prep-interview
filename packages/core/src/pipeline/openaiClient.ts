import { AbortError, withRetry } from "./retry";

/**
 * A thin wrapper over the OpenAI chat-completions endpoint using plain
 * `fetch` (Node 18+) rather than the `openai` SDK — one fewer dependency
 * for a single endpoint, and it keeps this module trivially mockable in
 * tests via dependency injection at the call site (pipeline steps accept
 * an injectable `callModel`, see extractRequirements.ts).
 *
 * Every call is wrapped in withRetry: a 429 or 5xx is retried with
 * backoff (§9's explicit warning about providers saying "slow down");
 * any other 4xx is treated as non-retryable via AbortError.
 */

export interface ChatJsonParams {
  apiKey: string;
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}

export class LlmResponseError extends Error {}

const DEFAULT_MODEL = "gpt-4o-mini";

export async function chatJson(params: ChatJsonParams): Promise<unknown> {
  const model = params.model ?? DEFAULT_MODEL;

  return withRetry(
    async () => {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: params.temperature ?? 0.3,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.user },
          ],
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        // Retryable: rate-limited or a transient provider-side failure.
        throw new Error(`OpenAI transient error (status ${res.status})`);
      }
      if (!res.ok) {
        const body = await res.text();
        throw new AbortError(`OpenAI request failed (status ${res.status}): ${body}`);
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (typeof content !== "string") {
        throw new LlmResponseError("OpenAI response missing message content");
      }

      try {
        return JSON.parse(content);
      } catch {
        // A JSON-mode response can still occasionally be truncated or
        // malformed — worth a retry rather than an immediate failure.
        throw new Error("Model returned invalid JSON");
      }
    },
    { retries: 4 },
  );
}
