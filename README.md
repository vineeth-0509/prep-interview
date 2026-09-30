# AI Interview Prep Kit

Turns a pasted job description + a company URL into a structured, editable interview prep kit: a company brief, a categorized question bank, flashcards, and a day-by-day study schedule — researched from the company's own site and public discussion of its interview process.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + Tailwind | Matches the brief's preferred stack. |
| Backend | Node.js + Express + TypeScript | Matches the preferred stack; kept thin — most logic lives in `@aipk/core`. |
| Database | MongoDB (Mongoose) | Matches the preferred stack; document shape maps directly onto the Kit structure. |
| LLM | OpenAI (`gpt-4o-mini`), plain `fetch` against the chat-completions endpoint | Genuine free-tier-friendly model; no SDK dependency for a single endpoint. |
| Search | Serper.dev | 2,500 free queries, **no credit card required at all** — checked current pricing before choosing, since Brave dropped its free tier in Feb 2026 and now requires a card on file even for its "free" credits, which fails a real no-cost-surface bar even if nothing gets charged. Serper's grant is one-time, not monthly — worth knowing before running the batch CLI many times. |
| Monorepo | npm workspaces, CommonJS throughout | Avoids Node ESM's `.js`-extension-on-relative-imports friction across `core`/`server`/`cli` in a short build. `web` (Next.js) interops with CJS packages transparently, so this cost nothing there. `web`'s own `tsconfig.json` doesn't extend the shared base, since Next.js requires bundler-mode resolution and JSX that the CommonJS base doesn't support. |

## Repo layout

```
packages/
  core/    pure pipeline logic: schema/validator, scheduler, coverage checker,
           classifier, crawler, LLM calls, orchestrator — no Express/Next/Mongoose
  server/  Express API: auth, persistence, wires @aipk/core into HTTP routes
  cli/     the batch entry point (§9) — calls the same @aipk/core pipeline
  web/     Next.js frontend
```

## Setup

### Local

```bash
git clone <repo>
cd interview-prep-kit
npm install   # this also builds @aipk/core automatically (postinstall)

# fill in real values (see each package's .env.example)
cp packages/server/.env.example packages/server/.env
cp packages/cli/.env.example packages/cli/.env
cp packages/web/.env.local.example packages/web/.env.local

npm run dev --workspace=@aipk/server   # http://localhost:4000
npm run dev --workspace=@aipk/web      # http://localhost:3000
```

MongoDB: point `MONGO_URI` at a local instance or a free MongoDB Atlas cluster.

Note: `npm install` only rebuilds `@aipk/core` once, at install time. If you edit any file under `packages/core/src` while `server`/`cli`/`web` are already running, re-run `npm run build --workspace=@aipk/core` by hand to pick up the change — the dev servers watch their own package's source, not core's compiled output.

### Batch entry point (mandatory, §9)

```bash
npm run evaluate -- --input cases.json --output kits.json
```

This is a root-level script that builds `@aipk/core` and then runs `packages/cli/src/evaluate.ts` — no separate manual build step needed beyond `npm install`. It reads env vars from `packages/cli/.env` (`OPENAI_API_KEY`, `SEARCH_API_KEY`, `ALLOW_LOCAL_FETCH`). Input/output shapes match Appendix B exactly. Cases are processed **sequentially**, not in parallel — free-tier providers rate-limit tokens per minute, not just requests (§2's own warning), and running 5 cases concurrently multiplies the peak request rate right when it's most likely to trip a 429. Sequential trades wall-clock time for staying under that limit; §9's 15-minute budget for 5 cases comfortably accommodates it even with retries.

### Deployment

- `server`: any Node host (Render/Fly/Railway free tier). Set all vars from `.env.example` plus `NODE_ENV=production`.
- `web`: Vercel free tier. Set `NEXT_PUBLIC_API_URL` to the deployed server's URL.
- Because frontend and backend are different origins in production, the session cookie is set `sameSite: "none"; secure: true` there (and `lax`/non-secure locally, so plain `http://localhost` still works without a TLS cert) — see `packages/server/src/utils/cookies.ts`.

## LLM provider

OpenAI, model `gpt-4o-mini`, JSON mode (`response_format: {type: "json_object"}`), called via plain `fetch` (no SDK) — `packages/core/src/pipeline/openaiClient.ts`.

## Architecture

`@aipk/core` is deliberately framework-free — it doesn't import Express, Next, or Mongoose — so the exact same pipeline code runs from an HTTP route (`server`) and from a CLI script (`cli`), which is what §9 requires ("the same code your application uses, not a parallel implementation"). Retrieval, extraction, generation, scheduling, and persistence are separate files with single responsibilities (`extractRequirements.ts`, `discoverHiringPages.ts`, `fetchPublicDiscussion.ts`, `generateCompanyBrief.ts`, `generateQuestions.ts`, `fillGaps.ts`, `scheduler.ts`, `coverage.ts`, `schema.ts`), composed by `orchestrator.ts`. Every I/O step accepts injectable dependencies (`callModel`, `fetchPageFn`, `searchFn`) so its test suite runs against fixtures with zero real network calls.

## Retrieval approach and sources

1. **Company site** (`discoverHiringPages.ts`): a breadth-limited **best-first** crawl, not plain BFS — every discovered link is scored by keyword match (`careers`, `hiring`, `handbook`, `engineering`, etc.; path weighted 2x, anchor text 1x), and the highest-scoring link *anywhere in the frontier* is fetched next, capped at depth 2 and 15 pages total. A strict BFS could burn the whole budget on low-value same-depth pages before ever reaching a two-hop hiring page — this targets the brief's actual instruction ("rank the links, fetch what looks right") instead of treating ranking as a tiebreaker. `robots.txt` is respected (missing/unreachable robots.txt doesn't block the crawl). Same-site is judged by **exact hostname match**, not apex-domain — a hiring page on a separate subdomain or third-party ATS (Greenhouse, Lever) is out of scope; a looser apex check risked false-positives on multi-part TLDs, which felt like the worse trade-off.
2. **Public discussion** (`fetchPublicDiscussion.ts`): four Serper queries (general + Glassdoor/Reddit/Blind site-scoped), top results deduped and retrieved through the same `fetchPage` path as the crawler.
3. Every fetch (`fetchPage.ts`) enforces the §11 safety rules: URL validated and its resolved IP checked against private/loopback/link-local ranges before fetching (bypassable only via an explicit `allowLocal` flag the *caller* passes — never read from env inside `/core` — so the CLI's localhost test fixtures work without weakening the deployed app's own safety); content-type restricted to `text/html`/`text/plain`; 2MB cap (truncated, not discarded, so an oversized-but-legitimate page still contributes). A fetch failure is recorded as skipped, never fatal to the run.

## Sequencing (why order matters here)

Pasted JD text needs no retrieval, so extraction runs immediately. The crawl and discussion-search run in parallel (neither depends on the other), and **both must finish before the company brief is generated**, since the brief is grounded only in what they actually found — it never runs a general knowledge query. Question generation is **one LLM call per requirement**, with a system prompt selected by that requirement's kind (`technical` leads to technical questions, `behavioural` leads to behavioural, `domain` leads to company-fit) — never one generic call asked to produce every category at once, and never batched unbounded (every generation call runs through a shared concurrency limiter, §9). The coverage check runs after the first full draft and triggers at most one gap-fill pass (capped at 2 total passes) before the kit is validated against the Appendix A schema and persisted.

## State model: generated / user_edited / user_created / pinned

Every editable item (requirement, question, flashcard, schedule day, company brief) carries an optional `meta: {source, pinned, version}`. An item survives a regeneration of its scope if **it's pinned OR its source isn't `"generated"`** — i.e., the user touched it (`packages/core/src/pipeline/regenerate.ts`). This one rule covers three different shapes of "section":

- **Lists** (questions, flashcards): `mergeRegeneratedList` keeps every preserved item, drops every untouched-generated item, and appends fresh ones in its place.
- **A single object** (company brief): `mergeRegeneratedSingle` is a no-op if the brief was pinned/edited, else replaces it wholesale.
- **The schedule**: regenerated as a whole (`buildSchedule` recomputes every day from the current question set), then `mergeRegeneratedSchedule` splices any pinned/edited day back in **by day number** — Appendix A's stable key for a schedule day — overwriting whatever the fresh recomputation put there.

One deliberate optimization on top of that: regenerating a question category first checks which of its requirements are already covered by a *preserved* question and skips those before spending an LLM call — otherwise a pinned question's requirement would still get a redundant fresh question generated (and then discarded) every time.

One accepted edge case, stated rather than hidden: if a pinned schedule day's `question_ids` include a question that a later category regeneration removes, that day's reference can go stale. Fully resolving that (blocking the regeneration, or migrating the reference) was out of scope for this build.

Regenerating the company brief re-fetches the URLs already recorded in `source.pages_used`, but does **not** re-run the public-discussion search — re-searching on every regen would burn Serper quota for a section a user is likely to regenerate more than once while iterating.

## Schedule allocation (§8)

`scheduler.ts` ranks every question (must-have first, then hardest first — a question counts as "must" if *any* linked requirement is must-have), gives each day a minute budget on a straight line from 120 minutes (day 1) down to 45 (the last day), and fills days in order. A day always accepts at least one item even if it alone exceeds budget (so one big question can't stall a day at zero). If the **last** day is also full and a must-have still doesn't fit, it's added anyway — must-haves are never dropped, budgets bend instead. A nice-to-have that doesn't fit anywhere is dropped from the *schedule* only (it stays in the question bank). Once every question is placed and days remain (e.g. a 60-day request against a thin JD), leftover days get **spaced review**: must-have question ids are re-referenced, rotating the starting subset per day so the tail isn't a verbatim repeat.

## Coverage / second pass (§4)

`coverage.ts`'s `checkCoverage` is a pure function — no LLM call — that returns every requirement id no question currently references. `fillGaps.ts` runs it after the first draft; if anything's uncovered, it generates fresh questions for exactly those requirements (continuing id numbering rather than colliding) and checks again. Capped at 2 total passes (initial + one gap-fill) — a requirement that still fails is reported honestly in `coverage.uncovered_requirement_ids` rather than looped on indefinitely.

## Edge cases (§10)

| Case | Handling |
|---|---|
| Company URL invalid/404/timeout | `fetchPage` never throws for an ordinary failure — returns `{ok:false, reason}`; crawl continues with whatever it has. |
| No discoverable hiring page | Company brief says so honestly (`generateCompanyBrief` skips the LLM call entirely and returns an explicit "nothing found" brief when both crawl and discussion come back empty). |
| Two-line JD stub | `extractRequirements`'s system prompt explicitly instructs against padding a thin JD with invented requirements. |
| No public discussion found | `fetchPublicDiscussion` returns `found: false`; not treated as an error. |
| Model returns invalid JSON / incomplete shape | Every generation step retries once (small, capped) on a zod-validation failure before throwing a named error; a single requirement's generation failing doesn't abort the run — it just stays uncovered for `fillGaps` to retry. |
| Rate-limited / provider briefly fails | `withRetry` (backoff + jitter) wraps every LLM/search/fetch call; 429/5xx retried, other 4xx aborted immediately. |
| Same JD + company submitted twice | Content-hash (`computeContentHash`) dedupe check in `createKit` short-circuits to the existing kit rather than re-running. |
| 1-day / 60-day schedule | See "Schedule allocation" above. |

## Security (§11)

- Every fetched URL is validated and its resolved address checked against private/loopback/link-local ranges before any request goes out (`security/urlSafety.ts`).
- Content-type allowlist + byte cap on every fetch.
- The pasted JD and every crawled/discussion page are wrapped in an explicit `<untrusted_content>` delimiter before reaching any prompt (`security/promptSafety.ts`), and phrases resembling an override attempt ("ignore previous instructions", etc.) are flagged in place rather than silently stripped — deletion risks quietly dropping a page's legitimate discussion of something that happens to match a pattern.

## Creative feature: Mock interview mode

A timed, sequential, typed run through a shuffled subset of the question bank — not just flipping through flashcards. The brief explicitly puts audio/video interview simulation out of scope, so this stays text-based: one question on screen at a time, a countdown (90s/150s/210s by difficulty — a different, shorter scale than the scheduler's study-planning minutes, since this is meant to approximate live response time), a text box, and no going back to fix an earlier answer once you've moved on. At the end, each answer sits next to that question's `answer_outline` for self-review, plus a simple count of how many were answered in time versus timed out.

The problem it solves: flashcard practice (already required) tests recognition — "yes, I know this" — but a real interview tests production under mild time pressure, where you actually have to commit to a specific answer rather than silently confirming to yourself that you probably could. Nothing here is persisted — a mock session is ephemeral practice, not part of the saved Kit, so it needed no new schema field, API route, or pipeline change; it's built entirely from data the kit already has.

## Known limitations

- Same-site crawl detection is exact-hostname, not apex-domain (see Retrieval section).
- Company name is a hostname heuristic (`pipeline/companyName.ts`), not real extraction — nothing upstream reliably produces a clean company name, and spending an LLM call guessing one from noisy material felt like a worse trade than a cheap, deterministic, occasionally-awkward guess.
- Pinned schedule days can reference a stale question id after a category regeneration removes that question (see State model).
- `fetchPage`'s byte cap is enforced after download when the server doesn't declare `Content-Length` (or lies about it) — a true streaming cap was out of scope for the timebox.
- No dedicated system-design question category is generated (see Sequencing) — an extension point, not a bug.
- Practice-mode confidence is stored client-side (localStorage) rather than on the persisted Kit — it's per-viewer session state, not part of the shareable Kit structure Appendix A defines. Mock interview sessions are similarly ephemeral and not persisted at all, by the same reasoning.

## Tests

`packages/core` has the automated-grading-relevant test coverage: schema/validator, scheduler (including the named 1-day/60-day edge cases), coverage checker, priority classifier, prompt-injection flagging, URL safety, content-hash dedupe, every pipeline step (via injected fakes — no real network calls in the suite), the regeneration merge rules, and one full end-to-end orchestrator test assembling a complete valid Kit from fixtures.

```bash
npm test --workspace=@aipk/core
```
