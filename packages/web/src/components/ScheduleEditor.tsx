"use client";

import { useState } from "react";
import type { Kit, ScheduleDay } from "@/lib/types";
import { MetaBadge, markEdited, togglePin } from "./MetaBadge";

export function ScheduleEditor({
  kit,
  onChange,
  onRegenerate,
  saving,
}: {
  kit: Kit;
  onChange: (kit: Kit) => void;
  onRegenerate: () => void;
  saving: boolean;
}) {
  const questionsById = new Map(kit.questions.map((q) => [q.id, q]));

  function updateDay(updated: ScheduleDay) {
    onChange({
      ...kit,
      schedule: {
        ...kit.schedule,
        days: kit.schedule.days.map((d) => (d.day === updated.day ? updated : d)),
      },
    });
  }

  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">
          Study schedule — {kit.schedule.days_available} day{kit.schedule.days_available === 1 ? "" : "s"}
        </h2>
        <button
          type="button"
          disabled={saving}
          onClick={onRegenerate}
          className="text-xs text-teal underline disabled:opacity-50"
        >
          Regenerate
        </button>
      </div>

      <ul className="mt-4 flex flex-col divide-y divide-line">
        {kit.schedule.days.map((day) => (
          <ScheduleDayRow
            key={day.day}
            day={day}
            questionsById={questionsById}
            onSave={updateDay}
            onTogglePin={() => updateDay({ ...day, meta: togglePin(day.meta) })}
          />
        ))}
      </ul>
    </section>
  );
}

function ScheduleDayRow({
  day,
  questionsById,
  onSave,
  onTogglePin,
}: {
  day: ScheduleDay;
  questionsById: Map<string, Kit["questions"][number]>;
  onSave: (d: ScheduleDay) => void;
  onTogglePin: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [focus, setFocus] = useState(day.focus);
  const [minutes, setMinutes] = useState(day.minutes);

  function save() {
    onSave({ ...day, focus, minutes, meta: markEdited(day.meta) });
    setEditing(false);
  }

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-slate">Day {day.day}</p>
          {editing ? (
            <div className="mt-1 flex items-center gap-3">
              <input
                value={focus}
                onChange={(e) => setFocus(e.target.value)}
                className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-teal"
              />
              <input
                type="number"
                min={0}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
                className="w-20 rounded-md border border-line px-2 py-1.5 text-sm outline-none focus:border-teal"
              />
              <button onClick={save} className="rounded-md bg-teal px-3 py-1 text-xs text-white">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="text-xs text-slate">
                Cancel
              </button>
            </div>
          ) : (
            <div onClick={() => setEditing(true)} className="mt-1 cursor-text">
              <p className="text-sm font-medium text-ink">
                {day.focus} · {day.minutes} min
              </p>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate">
                {day.question_ids.map((qid) => (
                  <li key={qid}>{questionsById.get(qid)?.prompt ?? qid}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <MetaBadge meta={day.meta} onTogglePin={onTogglePin} />
      </div>
    </li>
  );
}
