import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { runPipeline } from "@aipk/core";
import { env } from "./config/env";

/**
 * §9: "Your repository must expose one command that reads a file of
 * cases and writes the resulting kits to a file... Runs your full
 * retrieval, generation and validation path on each — the same code your
 * application uses, not a parallel implementation." This calls the exact
 * same @aipk/core runPipeline() the server uses — there is no separate
 * CLI-only pipeline.
 *
 * Cases are processed sequentially rather than in parallel. §2 warns
 * that free-tier providers rate-limit tokens per minute, not just
 * requests — running 5 cases concurrently would multiply the peak
 * request rate right when it's most likely to trip a 429. Sequential
 * processing trades wall-clock time for staying under that limit, and
 * §9's 15-minute budget for 5 cases comfortably accommodates it even
 * with retries.
 */

interface BatchCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

interface BatchKitEntry {
  id: string;
  status: "ok" | "failed";
  kit: unknown | null;
  error: { code: string; message: string } | null;
}

/**
 * Named --input/--output flags are the documented interface, but npm is
 * inconsistent about forwarding "--foo" style arguments through nested
 * `npm run` calls — depending on the npm version and platform, it can
 * mistake them for its own config flags and strip the flag names,
 * leaving just the bare values behind. Since this exact command is run
 * by an automated grader, this parser accepts plain positional
 * arguments (first = input, second = output) as a fallback rather than
 * assuming npm always forwards flags intact.
 */
/**
 * npm's workspace scripts (`npm run <script> --workspace=<name>`) change
 * the process's working directory into that package's folder before
 * running anything — so a relative --input/--output path typed at the
 * repo root would otherwise get looked up inside packages/cli instead.
 * npm always sets INIT_CWD to the directory the command was actually
 * run from, specifically so scripts can correct for this.
 */
function resolvePath(p: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), p);
}

function parseArgs(argv: string[]): { input?: string; output?: string } {
  const named: Record<string, string> = {};
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const eqIdx = key.indexOf("=");
      if (eqIdx !== -1) {
        named[key.slice(0, eqIdx)] = key.slice(eqIdx + 1);
      } else {
        named[key] = argv[i + 1];
        i++;
      }
    } else {
      positional.push(argv[i]);
    }
  }

  return {
    input: named.input ?? positional[0],
    output: named.output ?? positional[1],
  };
}

async function main() {
  const { input, output } = parseArgs(process.argv.slice(2));
  if (!input || !output) {
    // eslint-disable-next-line no-console
    console.error("Usage: npm run evaluate -- --input <cases.json> --output <kits.json>");
    process.exit(1);
  }

  const cases: BatchCase[] = JSON.parse(readFileSync(resolvePath(input), "utf8"));
  const kits: BatchKitEntry[] = [];

  for (const c of cases) {
    // eslint-disable-next-line no-console
    console.log(`[${c.id}] running...`);
    try {
      const result = await runPipeline({
        jdText: c.jd,
        companyUrl: c.company_url,
        daysRequested: c.days,
        openaiApiKey: env.OPENAI_API_KEY,
        serperApiKey: env.SEARCH_API_KEY,
        allowLocalFetch: env.ALLOW_LOCAL_FETCH,
      });

      if (!result.valid) {
        kits.push({
          id: c.id,
          status: "failed",
          kit: null,
          error: {
            code: "INVALID_KIT_STRUCTURE",
            message: result.validationErrors.map((e) => `${e.path}: ${e.message}`).join("; "),
          },
        });
        // eslint-disable-next-line no-console
        console.log(`[${c.id}] failed: invalid kit structure`);
        continue;
      }

      kits.push({ id: c.id, status: "ok", kit: result.kit, error: null });
      // eslint-disable-next-line no-console
      console.log(`[${c.id}] ok`);
    } catch (err) {
      // §9/§10: one case failing must not abort the run — record it and
      // continue to the next case.
      kits.push({
        id: c.id,
        status: "failed",
        kit: null,
        error: {
          code: "PIPELINE_ERROR",
          message: err instanceof Error ? err.message : "Unknown pipeline error",
        },
      });
      // eslint-disable-next-line no-console
      console.log(`[${c.id}] failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const outputPayload = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits,
  };
  writeFileSync(resolvePath(output), JSON.stringify(outputPayload, null, 2), "utf8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${kits.length} kit(s) to ${output}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error running the batch pipeline:", err);
  process.exit(1);
});
