"use client";

import { useState } from "react";
import Link from "next/link";
import type { KitListItem } from "@/lib/types";
import { api } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  idle: "Queued",
  running: "Generating…",
  completed: "Ready",
  failed: "Failed",
};

const STATUS_STYLE: Record<string, string> = {
  idle: "bg-slate/10 text-slate",
  running: "bg-teal/10 text-teal-dark",
  completed: "bg-teal/10 text-teal-dark",
  failed: "bg-red-100 text-red-800",
};

function DeleteKitButton({ kitId, onDeleted }: { kitId: string; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/kits/${kitId}`);
      onDeleted();
    } finally {
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
      >
        Delete
      </button>

      {confirming && (
        <>
          {/* Click-outside catcher — closes the popover without deleting */}
          <div className="fixed inset-0 z-10" onClick={() => setConfirming(false)} />
          <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-lg border border-line bg-white p-3 shadow-lg">
            <p className="text-sm text-ink">Delete this kit?</p>
            <p className="mt-1 text-xs text-slate">This can't be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-md border border-line px-3 py-1.5 text-xs text-ink hover:bg-paper"
              >
                No
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function KitList({ kits, onKitDeleted }: { kits: KitListItem[]; onKitDeleted: () => void }) {
  if (kits.length === 0) {
    return (
      <p className="mt-6 text-sm text-slate">
        No kits yet — paste a job description above to generate your first one.
      </p>
    );
  }

  return (
    <ul className="mt-6 flex flex-col divide-y divide-line border-y border-line">
      {kits.map((k) => (
        <li key={k._id} className="flex items-center justify-between gap-4 py-4">
          <Link href={`/kits/${k._id}`} className="flex flex-1 items-center justify-between gap-4 hover:opacity-80">
            <div>
              <p className="font-medium text-ink">
                {k.kit?.source?.role || "Untitled role"}
                {k.kit?.source?.company ? ` · ${k.kit.source.company}` : ""}
              </p>
              <p className="text-sm text-slate">{k.company_url}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLE[k.pipeline_status]}`}>
              {STATUS_LABEL[k.pipeline_status]}
              {k.pipeline_status === "running" && k.current_step ? ` — ${k.current_step}` : ""}
            </span>
          </Link>

          <DeleteKitButton kitId={k._id} onDeleted={onKitDeleted} />
        </li>
      ))}
    </ul>
  );
}
