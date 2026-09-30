import pRetry, { AbortError } from "p-retry";
import pLimit from "p-limit";

/**
 * §9 is explicit that this is the most common point-loser: "a pipeline
 * that falls over the first time a provider says 'slow down'." Every
 * outbound call in the pipeline (LLM calls, page fetches, search API
 * calls) should go through withRetry, and every batch of LLM calls
 * should go through a shared limiter from createLimiter — never fired
 * unbounded.
 */

export { AbortError };

export interface RetryOptions {
  retries?: number;
  minTimeoutMs?: number;
  onFailedAttempt?: (error: unknown, attemptNumber: number) => void;
}

const DEFAULT_RETRIES = 5;
const DEFAULT_MIN_TIMEOUT_MS = 1000;

/**
 * Wraps an async operation with exponential backoff + jitter (p-retry's
 * default jitter strategy). Use AbortError from this module inside `fn`
 * for errors that should never be retried (e.g. a 400 from a malformed
 * request) — everything else is retried up to `retries` times.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  return pRetry(fn, {
    retries: options.retries ?? DEFAULT_RETRIES,
    minTimeout: options.minTimeoutMs ?? DEFAULT_MIN_TIMEOUT_MS,
    factor: 2,
    randomize: true, // adds jitter so retries don't all land in lockstep
    onFailedAttempt: options.onFailedAttempt
      ? (error) => options.onFailedAttempt!(error, error.attemptNumber)
      : undefined,
  });
}

/**
 * A bounded concurrency limiter. §9: "never fire all requirement×category
 * generation calls in parallel unbounded" — wrap every batch of
 * concurrent LLM/fetch calls with the same limiter instance so the cap
 * applies across the whole batch, not per-call.
 */
export function createLimiter(concurrency = 4) {
  return pLimit(concurrency);
}
