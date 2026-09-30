"use client";

import { useEffect, useRef, useState } from "react";
import type { Question, QuestionCategory } from "@/lib/types";

/**
 * Creative feature (optional per the brief): a mock interview, not just
 * flashcard flip-through. The brief puts audio/video simulation out of
 * scope, so this is a timed, typed, sequential run — the part of a real
 * interview flashcards don't recreate: a countdown forcing you to
 * actually commit to an answer instead of silently thinking "I'd know
 * this" and moving on.
 *
 * Per-question time limit is difficulty-based but deliberately a
 * different scale than the scheduler's per-difficulty minutes
 * (MINUTES_BY_DIFFICULTY is study-planning time; this is live-response
 * time — roughly how long a real interview answer runs).
 *
 * Nothing here is persisted: a mock session is ephemeral practice, not
 * part of the saved Kit, so there's no new schema field or API call.
 */

const DIFFICULTY_TIME_SECONDS: Record<1 | 2 | 3, number> = { 1: 90, 2: 150, 3: 210 };

const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};

interface AnswerRecord {
  text: string;
  timeUsedSeconds: number;
  timedOut: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Stage = "setup" | "running" | "summary";

export function MockInterview({ questions }: { questions: Question[] }) {
  const [stage, setStage] = useState<Stage>("setup");
  const [categoryFilter, setCategoryFilter] = useState<QuestionCategory | "all">("all");
  const [questionCount, setQuestionCount] = useState(5);
  const [queue, setQueue] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [draft, setDraft] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  // A ref mirror of `draft`, read only by the auto-timeout path below —
  // the interval callback is created once per question inside an effect,
  // so it would otherwise close over whatever `draft` was at that exact
  // moment (empty) rather than whatever the person has typed since.
  const draftRef = useRef("");

  const available = categoryFilter === "all" ? questions : questions.filter((q) => q.category === categoryFilter);

  function updateDraft(value: string) {
    setDraft(value);
    draftRef.current = value;
  }

  function start() {
    const picked = shuffle(available).slice(0, Math.min(questionCount, available.length));
    setQueue(picked);
    setAnswers({});
    setCurrentIndex(0);
    setStage("running");
  }

  function advance(timedOut: boolean) {
    const q = queue[currentIndex];
    if (!q) return;

    const timeUsed = Math.round((Date.now() - startedAtRef.current) / 1000);
    setAnswers((prev) => ({
      ...prev,
      [q.id]: { text: draftRef.current, timeUsedSeconds: timeUsed, timedOut },
    }));

    if (currentIndex + 1 >= queue.length) {
      setStage("summary");
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }

  // Starts (and restarts) the countdown whenever the session moves to a
  // new question.
  useEffect(() => {
    if (stage !== "running" || !queue[currentIndex]) return;

    const limit = DIFFICULTY_TIME_SECONDS[queue[currentIndex].difficulty];
    updateDraft("");
    setTimeRemaining(limit);
    startedAtRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      setTimeRemaining((t) => {
        if (t <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          advance(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, currentIndex, queue.length]);

  function endEarly() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStage("summary");
  }

  function restart() {
    setStage("setup");
    setAnswers({});
  }

  if (stage === "setup") {
    return (
      <section className="rounded-lg border border-line bg-white p-6">
        <h2 className="font-display text-lg text-ink">Mock interview</h2>
        <p className="mt-1 text-sm text-slate">
          A timed, sequential run — one question at a time, a countdown, and a text box. No going
          back to fix an earlier answer, same as the real thing.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            Category
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as QuestionCategory | "all")}
              className="rounded-md border border-line px-3 py-2 text-sm"
            >
              <option value="all">All categories</option>
              {(Object.keys(CATEGORY_LABEL) as QuestionCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            Number of questions
            <input
              type="number"
              min={1}
              max={Math.max(available.length, 1)}
              value={questionCount}
              onChange={(e) => setQuestionCount(Number(e.target.value))}
              className="w-24 rounded-md border border-line px-3 py-2 text-sm"
            />
          </label>

          <button
            type="button"
            disabled={available.length === 0}
            onClick={start}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Start
          </button>
        </div>

        <p className="mt-3 text-xs text-slate">
          {available.length} question{available.length === 1 ? "" : "s"} available in this category.
          Time per question scales with difficulty (90s–210s).
        </p>
      </section>
    );
  }

  if (stage === "running") {
    const current = queue[currentIndex];
    if (!current) return null;
    const limit = DIFFICULTY_TIME_SECONDS[current.difficulty];
    const urgent = timeRemaining <= 15;

    return (
      <section className="rounded-lg border border-line bg-white p-6">
        <div className="flex items-center justify-between text-sm text-slate">
          <span>
            Question {currentIndex + 1} of {queue.length} · {CATEGORY_LABEL[current.category]}
          </span>
          <span className={`font-medium ${urgent ? "text-red-700" : "text-ink"}`}>
            {formatTime(timeRemaining)}
          </span>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className={`h-full rounded-full transition-all ${urgent ? "bg-red-600" : "bg-teal"}`}
            style={{ width: `${(timeRemaining / limit) * 100}%` }}
          />
        </div>

        <p className="mt-6 text-base text-ink">{current.prompt}</p>

        <textarea
          value={draft}
          onChange={(e) => updateDraft(e.target.value)}
          rows={6}
          autoFocus
          placeholder="Type your answer as you'd say it out loud…"
          className="mt-4 w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
        />

        <div className="mt-4 flex justify-between">
          <button type="button" onClick={endEarly} className="text-sm text-slate underline">
            End interview
          </button>
          <button
            type="button"
            onClick={() => advance(false)}
            className="rounded-md bg-teal px-4 py-2 text-sm font-medium text-white"
          >
            {currentIndex + 1 === queue.length ? "Finish" : "Next question"}
          </button>
        </div>
      </section>
    );
  }

  // stage === "summary"
  const answeredCount = queue.filter((q) => answers[q.id] && !answers[q.id].timedOut).length;
  const timedOutCount = queue.filter((q) => answers[q.id]?.timedOut).length;

  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Session summary</h2>
        <button type="button" onClick={restart} className="text-sm text-teal underline">
          New session
        </button>
      </div>
      <p className="mt-1 text-sm text-slate">
        {answeredCount} answered in time, {timedOutCount} timed out, out of {queue.length}.
      </p>

      <ul className="mt-4 flex flex-col divide-y divide-line">
        {queue.map((q) => {
          const a = answers[q.id];
          return (
            <li key={q.id} className="py-4">
              <p className="text-sm font-medium text-ink">{q.prompt}</p>
              <p className="mt-1 text-xs text-slate">
                {a ? `${formatTime(a.timeUsedSeconds)} used${a.timedOut ? " · timed out" : ""}` : "Skipped"}
              </p>

              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-md bg-paper p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate">Your answer</p>
                  <p className="mt-1 text-sm text-ink">{a?.text || "(no answer)"}</p>
                </div>
                <div className="rounded-md bg-teal-light p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-teal-dark">
                    Answer outline
                  </p>
                  <p className="mt-1 text-sm text-ink">{q.answer_outline || "(none provided)"}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
