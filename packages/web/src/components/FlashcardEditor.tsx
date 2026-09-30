"use client";

import { useState } from "react";
import type { Flashcard, Kit } from "@/lib/types";
import { MetaBadge, markEdited, togglePin } from "./MetaBadge";

function nextFlashcardId(flashcards: Flashcard[]): string {
  let max = 0;
  for (const f of flashcards) {
    const m = /^f(\d+)$/.exec(f.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `f${max + 1}`;
}

function FlashcardRow({
  card,
  onSave,
  onDelete,
  onTogglePin,
}: {
  card: Flashcard;
  onSave: (c: Flashcard) => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);

  function save() {
    onSave({ ...card, front, back, meta: markEdited(card.meta) });
    setEditing(false);
  }

  return (
    <li className="border-b border-line py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <input
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="Front"
                className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <textarea
                value={back}
                onChange={(e) => setBack(e.target.value)}
                rows={2}
                placeholder="Back"
                className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <div className="flex gap-2">
                <button onClick={save} className="rounded-md bg-teal px-3 py-1 text-xs text-white">
                  Save
                </button>
                <button onClick={() => setEditing(false)} className="text-xs text-slate">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div onClick={() => setEditing(true)} className="cursor-text">
              <p className="text-sm font-medium text-ink">{card.front}</p>
              <p className="mt-1 text-sm text-slate">{card.back}</p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <MetaBadge meta={card.meta} onTogglePin={onTogglePin} />
          <button onClick={onDelete} className="text-xs text-red-700">
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

export function FlashcardEditor({ kit, onChange }: { kit: Kit; onChange: (kit: Kit) => void }) {
  function updateFlashcards(flashcards: Flashcard[]) {
    onChange({ ...kit, flashcards });
  }

  function addFlashcard() {
    const card: Flashcard = {
      id: nextFlashcardId(kit.flashcards),
      front: "New flashcard front — click to edit",
      back: "",
      requirement_ids: [],
      meta: { source: "user_created", pinned: false, version: 0 },
    };
    updateFlashcards([...kit.flashcards, card]);
  }

  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Flashcards</h2>
        <button type="button" onClick={addFlashcard} className="text-xs text-teal underline">
          + Add flashcard
        </button>
      </div>

      {kit.flashcards.length === 0 ? (
        <p className="mt-3 text-sm text-slate">No flashcards yet.</p>
      ) : (
        <ul className="mt-2">
          {kit.flashcards.map((card) => (
            <FlashcardRow
              key={card.id}
              card={card}
              onSave={(updated) =>
                updateFlashcards(kit.flashcards.map((c) => (c.id === card.id ? updated : c)))
              }
              onDelete={() => updateFlashcards(kit.flashcards.filter((c) => c.id !== card.id))}
              onTogglePin={() =>
                updateFlashcards(
                  kit.flashcards.map((c) => (c.id === card.id ? { ...c, meta: togglePin(c.meta) } : c)),
                )
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}
