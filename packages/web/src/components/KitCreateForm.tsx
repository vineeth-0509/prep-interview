"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface BulkCase {
  id?: string;
  jd?: string; // the CLI's Appendix B field name
  jd_text?: string; // accepted as an alias, for flexibility
  company_url: string;
  days: number;
}

export function KitCreateForm({ onCreated }: { onCreated: () => void }) {
  const [jdText, setJdText] = useState("");
  const [companyUrl, setCompanyUrl] = useState("");
  const [days, setDays] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/api/kits", { jd_text: jdText, company_url: companyUrl, days });
      setJdText("");
      setCompanyUrl("");
      setDays(5);
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBulkFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    let cases: BulkCase[];
    try {
      cases = JSON.parse(await file.text());
      if (!Array.isArray(cases)) throw new Error("File must contain a JSON array.");
    } catch {
      setError("Couldn't parse that file — expected a JSON array of {jd, company_url, days} entries.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    let created = 0;
    let skipped = 0;
    for (const c of cases) {
      setBulkStatus(`Creating kit ${created + skipped + 1} of ${cases.length}…`);
      const jd_text = c.jd_text ?? c.jd;
      if (!jd_text || !c.company_url || !c.days) {
        skipped++;
        continue;
      }
      try {
        await api.post("/api/kits", { jd_text, company_url: c.company_url, days: c.days });
        created++;
      } catch {
        // one bad entry shouldn't stop the rest of the batch
        skipped++;
        continue;
      }
    }
    setBulkStatus(
      skipped > 0
        ? `Created ${created} of ${cases.length} kit(s) — ${skipped} entry(ies) skipped (missing fields or failed).`
        : `Created ${created} of ${cases.length} kit(s).`,
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
    onCreated();
  }

  return (
    <div className="rounded-lg border border-line bg-white p-6">
      <h2 className="font-display text-lg text-ink">New prep kit</h2>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          Job description
          <textarea
            required
            rows={8}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste the full job posting text here."
            className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
          />
        </label>

        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            Company website
            <input
              type="url"
              required
              value={companyUrl}
              onChange={(e) => setCompanyUrl(e.target.value)}
              placeholder="https://company.com"
              className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
          <label className="flex w-28 flex-col gap-1.5 text-sm">
            Days to prep
            <input
              type="number"
              required
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-teal"
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-teal px-4 py-2 text-sm font-medium text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {submitting ? "Starting…" : "Generate kit"}
        </button>
      </form>

      <div className="mt-6 border-t border-line pt-4">
        <p className="text-sm text-slate">
          Preparing for more than one role? Upload a JSON file of{" "}
          <code className="rounded bg-paper px-1 py-0.5 text-xs">
            {"{jd, company_url, days}"}
          </code>{" "}
          entries — the same format used by the batch CLI (an <code className="rounded bg-paper px-1 py-0.5 text-xs">id</code> field is fine to include but isn&apos;t required here).
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleBulkFile}
          className="mt-2 text-sm"
        />
        {bulkStatus && <p className="mt-2 text-sm text-teal-dark">{bulkStatus}</p>}
      </div>
    </div>
  );
}
