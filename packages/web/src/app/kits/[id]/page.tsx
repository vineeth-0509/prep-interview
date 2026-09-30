"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { useKit } from "@/hooks/useKit";
import { CompanyBriefEditor } from "@/components/CompanyBriefEditor";
import { QuestionBank } from "@/components/QuestionBank";
import { FlashcardEditor } from "@/components/FlashcardEditor";
import { ScheduleEditor } from "@/components/ScheduleEditor";
import { PracticeMode } from "@/components/PracticeMode";
import { MockInterview } from "@/components/MockInterview";
import type { Kit } from "@/lib/types";

const STEP_LABEL: Record<string, string> = {
  extract_requirements: "Reading the job description",
  discover_hiring_pages: "Crawling the company site",
  fetch_public_discussion: "Searching for interview discussion",
  generate_company_brief: "Writing the company brief",
  generate_questions: "Generating questions",
  fill_gaps: "Filling coverage gaps",
  build_schedule: "Building your schedule",
  validate: "Checking everything fits together",
};

const TABS = ["Overview", "Questions", "Flashcards", "Schedule", "Practice", "Mock Interview"] as const;
type Tab = (typeof TABS)[number];

function KitBuilder() {
  const params = useParams<{ id: string }>();
  const { doc, loading, saving, saveKit, regenerate } = useKit(params.id);
  const [tab, setTab] = useState<Tab>("Overview");

  if (loading) {
    return <main className="mx-auto max-w-4xl px-6 py-12 text-slate">Loading…</main>;
  }

  if (!doc) {
    return <main className="mx-auto max-w-4xl px-6 py-12 text-slate">Kit not found.</main>;
  }

  if (doc.pipeline_status === "running" || doc.pipeline_status === "idle") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-xl text-ink">Building your kit…</p>
        <p className="mt-2 text-sm text-slate">
          {doc.current_step ? STEP_LABEL[doc.current_step] ?? doc.current_step : "Getting started"}
        </p>
        <div className="mt-6 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-teal" />
        </div>
        <p className="mt-6 text-xs text-slate">This can take up to a couple of minutes.</p>
      </main>
    );
  }

  if (doc.pipeline_status === "failed") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="font-display text-xl text-ink">This kit couldn't be generated</p>
        <p className="mt-2 text-sm text-red-700">
          {doc.pipeline_error?.message ?? "An unknown error occurred."}
        </p>
        <Link href="/" className="mt-6 text-sm text-teal underline">
          Back to your kits
        </Link>
      </main>
    );
  }

  const kit = doc.kit as Kit;

  function onChange(updated: Kit) {
    saveKit(updated);
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm text-slate underline">
        ← Your kits
      </Link>

      <header className="mt-4">
        <h1 className="font-display text-2xl text-ink">
          {kit.role.title || "Untitled role"}
        </h1>
        <p className="mt-1 text-sm text-slate">
          {kit.source.company} · {kit.role.seniority}
        </p>
        {kit.coverage.uncovered_requirement_ids.length > 0 && (
          <p className="mt-2 text-sm text-amber">
            {kit.coverage.uncovered_requirement_ids.length} requirement(s) still have no question — see Overview.
          </p>
        )}
        {saving && <p className="mt-2 text-xs text-slate">Saving…</p>}
      </header>

      <nav className="mt-6 flex gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm ${
              tab === t ? "border-b-2 border-teal font-medium text-ink" : "text-slate"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div className="mt-6 flex flex-col gap-6">
        {tab === "Overview" && (
          <>
            <CompanyBriefEditor
              kit={kit}
              onChange={onChange}
              onRegenerate={() => regenerate("company_brief")}
              saving={saving}
            />
            <section className="rounded-lg border border-line bg-white p-6">
              <h2 className="font-display text-lg text-ink">Requirements</h2>
              <ul className="mt-3 flex flex-col divide-y divide-line">
                {kit.role.requirements.map((r) => {
                  const covered = !kit.coverage.uncovered_requirement_ids.includes(r.id);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-4 py-2">
                      <span className="text-sm text-ink">{r.text}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <span
                          className={
                            r.priority === "must"
                              ? "rounded-full bg-teal-light px-2 py-0.5 text-teal-dark"
                              : "rounded-full bg-amber-light px-2 py-0.5 text-amber"
                          }
                        >
                          {r.priority === "must" ? "Must-have" : "Nice-to-have"}
                        </span>
                        {!covered && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">No question yet</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </>
        )}

        {tab === "Questions" && (
          <QuestionBank
            kit={kit}
            onChange={onChange}
            onRegenerateCategory={(category) => regenerate(category)}
            saving={saving}
          />
        )}

        {tab === "Flashcards" && <FlashcardEditor kit={kit} onChange={onChange} />}

        {tab === "Schedule" && (
          <ScheduleEditor kit={kit} onChange={onChange} onRegenerate={() => regenerate("schedule")} saving={saving} />
        )}

        {tab === "Practice" && <PracticeMode kitId={doc._id} flashcards={kit.flashcards} />}

        {tab === "Mock Interview" && <MockInterview questions={kit.questions} />}
      </div>
    </main>
  );
}

export default function KitPage() {
  return (
    <RequireAuth>
      <KitBuilder />
    </RequireAuth>
  );
}
