"use client";

import { useEffect, useMemo, useState } from "react";
import type { Flashcard } from "@/lib/types";

/**
 * §7's practice-mode ordering is deliberately left open ("a simple
 * confidence-weighted sort is fine; a proper spaced-repetition interval
 * is fine — pick one and defend it"). This picks the simple sort:
 * flashcards the person marked "Again" (or haven't seen at all) come
 * first, "Easy" cards drop to the back. No decay/interval scheduling —
 * defensible for a first pass, and it's the whole state a confidence
 * value needs to be useful here.
 *
 * Confidence is stored in localStorage rather than added to the
 * persisted Kit: it's per-viewer practice history, not part of the
 * shareable Kit structure Appendix A defines.
 */

type Confidence = 1 | 2 | 3; // 1 = Again, 2 = Good, 3 = Easy

interface ConfidenceMap {
  [flashcardId: string]: { confidence: Confidence; lastSeenAt: string };
}

function storageKey(kitId: string) {
  return `aipk:practice:${kitId}`;
}

function loadConfidence(kitId: string): ConfidenceMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(kitId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function PracticeMode({ kitId, flashcards }: { kitId: string; flashcards: Flashcard[] }) {
  const [confidence, setConfidence] = useState<ConfidenceMap>({});
  const [revealed, setRevealed] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    setConfidence(loadConfidence(kitId));
  }, [kitId]);

  const ordered = useMemo(() => {
    return [...flashcards].sort((a, b) => {
      const scoreA = confidence[a.id]?.confidence ?? 0; // unseen sorts first
      const scoreB = confidence[b.id]?.confidence ?? 0;
      return scoreA - scoreB;
    });
  }, [flashcards, confidence]);

  const coveredCount = flashcards.filter((f) => confidence[f.id]).length;
  const current = ordered[cursor];

  function record(value: Confidence) {
    if (!current) return;
    const next = { ...confidence, [current.id]: { confidence: value, lastSeenAt: new Date().toISOString() } };
    setConfidence(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(kitId), JSON.stringify(next));
    }
    setRevealed(false);
    setCursor((c) => (c + 1) % Math.max(ordered.length, 1));
  }

  if (flashcards.length === 0) {
    return <p className="text-sm text-slate">No flashcards to practice yet.</p>;
  }

  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Practice</h2>
        <p className="text-sm text-slate">
          {coveredCount} of {flashcards.length} covered
        </p>
      </div>

      {current && (
        <div className="mt-6">
          <div
            onClick={() => setRevealed((r) => !r)}
            className="flex min-h-[10rem] cursor-pointer flex-col items-center justify-center rounded-lg border border-line bg-paper p-8 text-center"
          >
            <p className="text-base text-ink">{revealed ? current.back : current.front}</p>
            {!revealed && <p className="mt-3 text-xs text-slate">Click to reveal the answer</p>}
          </div>

          {revealed && (
            <div className="mt-4 flex justify-center gap-3">
              <button
                onClick={() => record(1)}
                className="rounded-md border border-line px-4 py-2 text-sm hover:border-red-400"
              >
                Again
              </button>
              <button
                onClick={() => record(2)}
                className="rounded-md border border-line px-4 py-2 text-sm hover:border-amber"
              >
                Good
              </button>
              <button
                onClick={() => record(3)}
                className="rounded-md border border-line px-4 py-2 text-sm hover:border-teal"
              >
                Easy
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
