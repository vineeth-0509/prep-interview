"use client";

import type { ItemMeta } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  generated: "Generated",
  user_edited: "Edited by you",
  user_created: "Added by you",
};

export function MetaBadge({
  meta,
  onTogglePin,
}: {
  meta?: ItemMeta;
  onTogglePin: () => void;
}) {
  const source = meta?.source ?? "generated";
  const pinned = meta?.pinned ?? false;

  return (
    <div className="flex items-center gap-2 text-xs text-slate">
      <span>{SOURCE_LABEL[source]}</span>
      <button
        type="button"
        onClick={onTogglePin}
        aria-pressed={pinned}
        title={pinned ? "Unpin — a regeneration may replace this" : "Pin — protects this from regeneration"}
        className={`rounded-full border px-2 py-0.5 ${
          pinned ? "border-teal bg-teal-light text-teal-dark" : "border-line text-slate hover:border-teal"
        }`}
      >
        {pinned ? "Pinned" : "Pin"}
      </button>
    </div>
  );
}

export function markEdited(meta: ItemMeta | undefined): ItemMeta {
  return {
    source: meta?.source === "user_created" ? "user_created" : "user_edited",
    pinned: meta?.pinned ?? false,
    version: (meta?.version ?? 0) + 1,
  };
}

export function togglePin(meta: ItemMeta | undefined): ItemMeta {
  return {
    source: meta?.source ?? "generated",
    pinned: !(meta?.pinned ?? false),
    version: meta?.version ?? 0,
  };
}
