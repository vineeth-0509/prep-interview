"use client";

import { useState } from "react";
import type { Kit } from "@/lib/types";
import { MetaBadge, markEdited, togglePin } from "./MetaBadge";

export function CompanyBriefEditor({
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
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState(kit.company_brief.summary);
  const [whatTheyDo, setWhatTheyDo] = useState(kit.company_brief.what_they_do);

  function save() {
    onChange({
      ...kit,
      company_brief: {
        ...kit.company_brief,
        summary,
        what_they_do: whatTheyDo,
        meta: markEdited(kit.company_brief.meta),
      },
    });
    setEditing(false);
  }

  return (
    <section className="rounded-lg border border-line bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-display text-lg text-ink">Company brief</h2>
        <div className="flex items-center gap-3">
          <MetaBadge
            meta={kit.company_brief.meta}
            onTogglePin={() =>
              onChange({ ...kit, company_brief: { ...kit.company_brief, meta: togglePin(kit.company_brief.meta) } })
            }
          />
          <button
            type="button"
            disabled={saving}
            onClick={onRegenerate}
            className="text-xs text-teal underline disabled:opacity-50"
          >
            Regenerate
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 flex flex-col gap-3">
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
          />
          <textarea
            value={whatTheyDo}
            onChange={(e) => setWhatTheyDo(e.target.value)}
            rows={2}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-teal"
          />
          <div className="flex gap-2">
            <button onClick={save} className="rounded-md bg-teal px-3 py-1.5 text-sm text-white">
              Save
            </button>
            <button onClick={() => setEditing(false)} className="text-sm text-slate">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 cursor-text" onClick={() => setEditing(true)}>
          <p className="text-sm text-ink">{kit.company_brief.summary}</p>
          {kit.company_brief.what_they_do && (
            <p className="mt-2 text-sm text-slate">{kit.company_brief.what_they_do}</p>
          )}
        </div>
      )}

      {kit.company_brief.sources.length > 0 && (
        <p className="mt-4 text-xs text-slate">
          Sources: {kit.company_brief.sources.join(", ")}
        </p>
      )}
    </section>
  );
}
