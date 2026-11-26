"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { toApiError } from "@/lib/api";
import { tutorApi } from "@/lib/api-staff";
import { IMPORT_PROMPT, IMPORT_SAMPLE, parseImport } from "@/lib/import-exam";
import { useAsync } from "@/lib/hooks/useAsync";
import { KIND_META } from "@/lib/question-kinds";
import { cn, plural } from "@/lib/utils";
import { BackLink, StatusChip } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, Card, ErrorState, KindBadge, Notice, Skeleton } from "@/components/ui";

export function ImportExamScreen() {
  const params = useParams<{ examId: string }>();
  const examId = Number(params.examId);
  const { data, error, loading, reload } = useAsync(() => tutorApi.builder(examId), [examId]);

  return (
    <>
      <StaffMain className="gap-5">
        <BackLink href={`/tutor/exams/${examId}`}>{data?.title.trim() || "Back to the exam"}</BackLink>
        {loading && <Skeleton className="h-[30rem] rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={error.code === "network" ? reload : undefined} backHref="/tutor" backLabel="Back to my exams" />}
        {data && (
          data.canEdit ? (
            <ImportContent examId={examId} untitled={data.title === "Untitled exam"} />
          ) : (
            <Notice variant="info" title="This exam is locked">
              Published exams can&apos;t take new questions.
            </Notice>
          )
        )}
      </StaffMain>
    </>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-black text-white">{n}</span>
      <h2 className="text-[19px] font-black">{title}</h2>
    </div>
  );
}

function ImportContent({ examId, untitled }: { examId: number; untitled: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pasted, setPasted] = useState("");
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const result = useMemo(() => parseImport(pasted), [pasted]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast("Couldn't copy automatically. Select the text and copy it yourself.", "error");
    }
  }

  async function add() {
    setAdding(true);
    try {
      const { added } = await tutorApi.importQuestions(examId, result.drafts);
      // A brand-new exam takes its title, time and rules from the import too.
      if (untitled && (result.meta.title || result.meta.minutes || result.meta.rules)) {
        await tutorApi.updateExam(examId, { title: result.meta.title, timeLimitMinutes: result.meta.minutes, rules: result.meta.rules });
      }
      toast(`${plural(added, "question")} added. Check each answer key and approve it.`);
      router.push(`/tutor/exams/${examId}`);
    } catch (e) {
      toast(toApiError(e).message, "error");
      setAdding(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[28px] font-black leading-tight md:text-[32px]">Import an exam</h1>
        <p className="max-w-[720px] text-base font-bold leading-relaxed text-muted">
          Already written it in Word, or just have notes? Let ChatGPT, Claude or Gemini turn it into the right format, then paste the
          result here. Nothing goes live until you&apos;ve checked and approved every question.
        </p>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4">
          <Card className="flex flex-col gap-3.5 p-[22px]">
            <Step n={1} title="Copy this prompt" />
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-[18px] bg-paper p-4 font-mono text-xs leading-relaxed text-ink-2">
              {IMPORT_PROMPT}
            </pre>
            <Button variant={copied ? "soft" : "primary"} onClick={() => void copy()} className={cn(copied && "bg-mint text-mint-deep hover:bg-mint")}>
              {copied ? <Check className="size-5" strokeWidth={3} aria-hidden /> : <Copy className="size-5" aria-hidden />}
              {copied ? "Copied" : "Copy prompt"}
            </Button>
          </Card>

          <Card className="flex flex-col gap-3 p-[22px]">
            <Step n={2} title="Paste it into your AI tool" />
            <p className="text-[15px] font-semibold leading-relaxed text-ink-2">
              Add your exam underneath: attach the Word or PDF file, paste the text, or just paste your notes and say how many questions of
              each type you want.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Word or PDF exam", "Typed questions", "Lesson notes", "Photo of a paper"].map((t) => (
                <span key={t} className="rounded-full bg-chip px-3 py-1.5 text-[13px] font-extrabold">
                  {t}
                </span>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex min-w-0 flex-[1_1_460px] flex-col gap-3.5 p-[22px]">
          <Step n={3} title="Paste the result here" />
          <label className="flex flex-col gap-1.5">
            <span className="sr-only">AI result</span>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={9}
              spellCheck={false}
              placeholder='{ "title": "…", "questions": [ … ] }'
              className="w-full resize-y rounded-[18px] border-2 border-line-input bg-[#fffdfb] px-4 py-3.5 font-mono text-xs leading-relaxed outline-none transition focus:border-secondary focus:ring-4 focus:ring-secondary-ring"
            />
          </label>
          {!pasted.trim() && (
            <button type="button" onClick={() => setPasted(JSON.stringify(IMPORT_SAMPLE, null, 2))} className="self-start text-sm font-extrabold text-secondary underline-offset-2 hover:underline">
              No AI reply handy? Try an example
            </button>
          )}

          {result.error && <Notice variant="error">{result.error}</Notice>}

          {result.rows.length > 0 && (
            <>
              <div className="flex flex-wrap items-baseline justify-between gap-2.5">
                <h3 className="text-base font-black">
                  Preview · {plural(result.drafts.length, "question")} · {plural(result.marks, "mark")}
                </h3>
                <StatusChip tone={result.issues ? "amber" : "mint"}>
                  {result.issues ? `${plural(result.issues, "thing")} to fix` : "All answer keys present"}
                </StatusChip>
              </div>

              <ul className="flex flex-col gap-2">
                {result.rows.map((r) => (
                  <li
                    key={r.n}
                    className={cn("flex items-center gap-3 rounded-[18px] px-3 py-2.5", r.issue ? "border-2 border-amber-line bg-amber-soft" : "border border-[#f0ece5] bg-canvas")}
                  >
                    {r.kind ? (
                      <KindBadge kind={r.kind} label={String(r.n)} className="size-[38px] shrink-0 rounded-xl" />
                    ) : (
                      <span className="grid size-[38px] shrink-0 place-items-center rounded-xl bg-chip font-black text-ink-2">{r.n}</span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-xs font-extrabold text-muted">
                        {r.kind ? KIND_META[r.kind].label : "Unknown type"} · {plural(r.points, "mark")}
                        {r.keyText && ` · ${r.keyText}`}
                      </span>
                      <span className="truncate text-sm font-bold">{r.prompt}</span>
                      {r.issue && <span className="text-xs font-extrabold text-amber-ink">{r.issue}</span>}
                    </div>
                  </li>
                ))}
              </ul>

              <Button size="lg" onClick={() => void add()} loading={adding} disabled={result.drafts.length === 0}>
                Add {plural(result.drafts.length, "question")} to the draft
              </Button>
              <p className="text-[13px] font-bold leading-relaxed text-muted">
                They arrive unapproved, so you still check every answer key before publishing. Anything flagged above can be fixed in the
                question editor.
              </p>
            </>
          )}
        </Card>
      </div>
    </>
  );
}
