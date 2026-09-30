"use client";

import { useState } from "react";
import type { Kit, Question, QuestionCategory } from "@/lib/types";
import { MetaBadge, markEdited, togglePin } from "./MetaBadge";

const CATEGORIES: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];
const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  technical: "Technical",
  behavioural: "Behavioural",
  "system-design": "System Design",
  "company-fit": "Company Fit",
};
// Only these are ever produced by generateQuestions.ts's kind->category
// mapping, so only these can be regenerated server-side.
const REGENERATABLE: QuestionCategory[] = ["technical", "behavioural", "company-fit"];

function nextQuestionId(questions: Question[]): string {
  let max = 0;
  for (const q of questions) {
    const m = /^q(\d+)$/.exec(q.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `q${max + 1}`;
}

function QuestionRow({
  question,
  onSave,
  onDelete,
  onMove,
  onTogglePin,
  onMoveCategory,
  isFirst,
  isLast,
}: {
  question: Question;
  onSave: (q: Question) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  onTogglePin: () => void;
  onMoveCategory: (category: QuestionCategory) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [prompt, setPrompt] = useState(question.prompt);
  const [outline, setOutline] = useState(question.answer_outline);
  const [difficulty, setDifficulty] = useState(question.difficulty);

  function save() {
    onSave({ ...question, prompt, answer_outline: outline, difficulty, meta: markEdited(question.meta) });
    setEditing(false);
  }

  return (
    <li className="border-b border-line py-4 last:border-b-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <textarea
                value={outline}
                onChange={(e) => setOutline(e.target.value)}
                rows={2}
                placeholder="Answer outline"
                className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate">
                  Difficulty
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(Number(e.target.value) as 1 | 2 | 3)}
                    className="ml-2 rounded border border-line px-1 py-0.5 text-xs"
                  >
                    <option value={1}>1 — Easy</option>
                    <option value={2}>2 — Medium</option>
                    <option value={3}>3 — Hard</option>
                  </select>
                </label>
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
              <p className="text-sm text-ink">{question.prompt}</p>
              {question.answer_outline && (
                <p className="mt-1 text-sm text-slate">{question.answer_outline}</p>
              )}
              <p className="mt-1 text-xs text-slate">Difficulty {question.difficulty}/3</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <MetaBadge meta={question.meta} onTogglePin={onTogglePin} />
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => onMove("up")} disabled={isFirst} className="text-slate disabled:opacity-30">
              ↑
            </button>
            <button onClick={() => onMove("down")} disabled={isLast} className="text-slate disabled:opacity-30">
              ↓
            </button>
            <select
              value={question.category}
              onChange={(e) => onMoveCategory(e.target.value as QuestionCategory)}
              className="rounded border border-line px-1 py-0.5 text-xs"
              title="Move to another category"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <button onClick={onDelete} className="text-red-700">
              Delete
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function QuestionBank({
  kit,
  onChange,
  onRegenerateCategory,
  saving,
}: {
  kit: Kit;
  onChange: (kit: Kit) => void;
  onRegenerateCategory: (category: string) => void;
  saving: boolean;
}) {
  function updateQuestions(questions: Question[]) {
    onChange({ ...kit, questions });
  }

  function addQuestion(category: QuestionCategory) {
    const newQuestion: Question = {
      id: nextQuestionId(kit.questions),
      requirement_ids: [],
      category,
      prompt: "New question — click to edit",
      answer_outline: "",
      difficulty: 2,
      meta: { source: "user_created", pinned: false, version: 0 },
    };
    updateQuestions([...kit.questions, newQuestion]);
  }

  return (
    <section className="flex flex-col gap-6">
      {CATEGORIES.map((category) => {
        const inCategory = kit.questions.filter((q) => q.category === category);
        if (inCategory.length === 0 && !REGENERATABLE.includes(category)) return null;

        return (
          <div key={category} className="rounded-lg border border-line bg-white p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base text-ink">{CATEGORY_LABEL[category]}</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => addQuestion(category)}
                  className="text-xs text-teal underline"
                >
                  + Add question
                </button>
                {REGENERATABLE.includes(category) && (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onRegenerateCategory(category)}
                    className="text-xs text-teal underline disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </div>

            {inCategory.length === 0 ? (
              <p className="mt-3 text-sm text-slate">No questions in this category yet.</p>
            ) : (
              <ul className="mt-2">
                {inCategory.map((q, idx) => (
                  <QuestionRow
                    key={q.id}
                    question={q}
                    isFirst={idx === 0}
                    isLast={idx === inCategory.length - 1}
                    onSave={(updated) =>
                      updateQuestions(kit.questions.map((existing) => (existing.id === q.id ? updated : existing)))
                    }
                    onDelete={() => updateQuestions(kit.questions.filter((existing) => existing.id !== q.id))}
                    onTogglePin={() =>
                      updateQuestions(
                        kit.questions.map((existing) =>
                          existing.id === q.id ? { ...existing, meta: togglePin(existing.meta) } : existing,
                        ),
                      )
                    }
                    onMoveCategory={(newCategory) =>
                      updateQuestions(
                        kit.questions.map((existing) =>
                          existing.id === q.id
                            ? { ...existing, category: newCategory, meta: markEdited(existing.meta) }
                            : existing,
                        ),
                      )
                    }
                    onMove={(direction) => {
                      const swapWith = direction === "up" ? inCategory[idx - 1] : inCategory[idx + 1];
                      if (!swapWith) return;
                      const aIdx = kit.questions.findIndex((x) => x.id === q.id);
                      const bIdx = kit.questions.findIndex((x) => x.id === swapWith.id);
                      const reordered = [...kit.questions];
                      [reordered[aIdx], reordered[bIdx]] = [reordered[bIdx], reordered[aIdx]];
                      updateQuestions(reordered);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
