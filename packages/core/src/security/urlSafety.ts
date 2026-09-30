import { lookup as dnsLookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

/**
 * §11: "reject private, loopback, and link-local IP ranges in production."
 * The batch CLI's test harness serves companies from localhost (§18), so
 * this check must be bypassable — but only via an explicit flag the
 * *caller* passes in, never read from process.env here. Keeping env
 * access out of /core (which is meant to be framework/environment-free)
 * means the bypass is decided once, by the server/CLI bootstrap code that
 * reads ALLOW_LOCAL_FETCH, not scattered through pipeline internals.
 */

export class UnsafeUrlError extends Error {}

const UNSAFE_RANGES = new Set([
  "private",
  "loopback",
  "linkLocal",
  "uniqueLocal",
  "reserved",
  "carrierGradeNat",
  "unspecified",
  "broadcast",
]);

/** Pure and directly testable: is this literal IP address safe to fetch? */
export function isSafeAddress(address: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(address);
  } catch {
    return false; // unparseable address — refuse rather than guess
  }
  return !UNSAFE_RANGES.has(parsed.range());
}

/**
 * Validates a URL's protocol, then (unless explicitly bypassed) resolves
 * its hostname and rejects it if any resolved address is private,
 * loopback, or link-local. Throws UnsafeUrlError on any rejection —
 * pipeline steps catch this and record the source as skipped (§6.2 step
 * 2) rather than letting it fail the whole run.
 */
export async function assertSafeUrl(
  rawUrl: string,
  options?: { allowLocal?: boolean },
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError(`Unsupported protocol: ${parsed.protocol}`);
  }

  if (options?.allowLocal) {
    return parsed; // CLI/test-fixture escape hatch only — see module docstring
  }

  const results = await dnsLookup(parsed.hostname, { all: true });
  for (const { address } of results) {
    if (!isSafeAddress(address)) {
      throw new UnsafeUrlError(
        `Refusing to fetch ${parsed.hostname}: resolves to a private/loopback/link-local address`,
      );
    }
  }

  return parsed;
}
