"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Minus, Plus } from "lucide-react";
import { toApiError } from "@/lib/api";
import { tutorApi } from "@/lib/api-staff";
import { gradeFor, percentOf } from "@/lib/grading";
import type { MarkingData } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { KIND_META } from "@/lib/question-kinds";
import { cn, formatTime, plural } from "@/lib/utils";
import { BackLink, TiltTile, inputClass, textareaClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, Card, Chip, ErrorState, GradeTile, KindBadge, Notice, Skeleton } from "@/components/ui";

export function MarkAttemptScreen() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = Number(params.attemptId);
  const { data, error, loading, reload } = useAsync(() => tutorApi.attempt(attemptId), [attemptId]);

  return (
    <>
      <StaffMain className="gap-[18px]">
        {loading && <Skeleton className="h-[40rem] rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={error.code === "network" ? reload : undefined} backHref="/tutor/marking" backLabel="Back to marking" />}
        {data && <MarkContent key={data.attemptId} data={data} />}
      </StaffMain>
    </>
  );
}

const WHY = {
  manual: "Submitted by student",
  timeout: "Time ran out",
  violations: "Auto-submitted after 3 violations",
  closed: "Submitted when you closed the exam",
} as const;

function MarkContent({ data }: { data: MarkingData }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState(() =>
    Object.fromEntries(
      data.written.map((w) => [w.questionId, { ticks: w.ticks, mark: w.awarded ?? w.ticks.length, feedback: w.feedback }]),
    ),
  );
  const [overall, setOverall] = useState(data.overallComment);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const back = `/tutor/exams/${data.examId}/sessions`;
  const editable = data.canEdit;

  const writtenTotal = data.written.reduce((n, w) => n + (state[w.questionId]?.mark ?? 0), 0);
  const total = data.objectiveScore + writtenTotal;
  const pct = percentOf(total, data.totalMarks);
  const grade = gradeFor(total, data.totalMarks);
  const toMark = data.status === "submitted" ? data.written.length : 0;

  function patch(id: number, next: Partial<(typeof state)[number]>) {
    setState((s) => ({ ...s, [id]: { ...s[id], ...next } }));
  }

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      await tutorApi.saveMarks(data.attemptId, {
        answers: data.written.map((w) => ({ questionId: w.questionId, awarded: state[w.questionId].mark, feedback: state[w.questionId].feedback, ticks: state[w.questionId].ticks })),
        overallComment: overall,
      });
      toast(`Marks saved for ${data.firstName}`);
      router.push(back);
    } catch (e) {
      setProblem(toApiError(e).message);
      setSaving(false);
    }
  }

  return (
    <>
      <BackLink href={back}>
        {data.examTitle} · {data.className.split(",")[1]?.trim() ?? data.className}
      </BackLink>

      <Card className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5 rounded-[28px] px-[22px] py-5">
        <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-mint text-lg font-black text-mint-deep">
          {data.student.initials}
        </span>
        <div className="flex min-w-0 flex-1 basis-60 flex-col gap-0.5">
          <h1 className="text-[26px] font-black leading-tight">{data.student.name}</h1>
          <span className="text-sm font-bold text-muted">
            {data.submitReason ? WHY[data.submitReason] : "Still sitting"}
            {data.submittedAt && ` · ${formatTime(data.submittedAt)}`} · {data.answered} of {data.questionCount} answered
          </span>
        </div>
        {data.violations.length > 0 && (
          <Chip tone="peach" size="lg">
            Left the window {data.violations.length === 1 ? "once" : `${data.violations.length} times`}
          </Chip>
        )}
        <Chip tone={toMark > 0 ? "amber" : "mint"} size="lg">
          {toMark > 0 ? `${toMark} of ${data.written.length} to mark` : data.released ? "Results released" : "Marked"}
        </Chip>
      </Card>

      {!editable && (
        <Notice variant="info" title="View only">
          {data.released ? "Results are released, so marks can't change." : "Only the teacher who owns this exam can change marks."}
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <aside className="flex max-w-none flex-[1_1_260px] flex-col gap-4 lg:max-w-[320px]">
          <Card className="flex flex-col gap-2.5 rounded-[26px] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[17px] font-black">Auto-marked</h2>
              <span className="text-[15px] font-black text-secondary-dark">
                {data.objectiveScore} / {data.objectiveTotal}
              </span>
            </div>
            {data.objective.length === 0 && <p className="text-sm font-bold text-muted">This exam has no auto-marked questions.</p>}
            {data.objective.map((o) => (
              <div key={o.position} className="flex items-center gap-2.5">
                <KindBadge kind={o.kind} label={String(o.position)} className="size-7 shrink-0 rounded-[9px] text-xs" />
                <span className={cn("min-w-0 flex-1 truncate text-[13px] font-bold", o.answer === "Not answered" ? "text-subtle" : "text-ink-2")}>{o.answer}</span>
                <span className={cn("rounded-full px-2 py-[3px] text-xs font-black", o.awarded >= o.points ? "bg-mint text-mint-deep" : "bg-rose text-rose-ink")}>
                  {o.awarded}/{o.points}
                </span>
              </div>
            ))}
          </Card>

          {data.violations.length > 0 && (
            <section className="flex flex-col gap-2.5 rounded-[26px] bg-peach-soft p-5">
              <h2 className="text-base font-black text-peach-deep">Left the exam window</h2>
              {data.violations.map((v, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-[5px] size-2.5 shrink-0 rounded-full bg-peach-bar" />
                  <span className="text-[13px] font-bold leading-snug text-peach-text">
                    {formatTime(v.at)} · {v.kind === "hidden" ? "switched tab or app" : "clicked outside the exam window"}
                  </span>
                </div>
              ))}
            </section>
          )}
        </aside>

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          {data.written.length === 0 && <Notice variant="success">Everything on this exam was marked automatically.</Notice>}

          {data.written.map((w) => {
            const s = state[w.questionId];
            return (
              <Card key={w.questionId} className="flex flex-col gap-3.5 p-6">
                <div className="flex items-center gap-3">
                  <TiltTile tone={cn(KIND_META.written.bg, KIND_META.written.fg)} className="size-11 -rotate-6 rounded-[15px] font-black">
                    Q{w.position}
                  </TiltTile>
                  <span className="text-sm font-extrabold text-muted">
                    Written answer · {plural(w.points, "mark")}
                  </span>
                </div>
                <p className="max-w-[640px] text-[17px] font-extrabold leading-snug">{w.prompt}</p>
                <div className={cn("rounded-[20px] bg-paper px-[18px] py-4 text-[15px] leading-relaxed", w.answer ? "whitespace-pre-wrap font-semibold text-[#2c3140]" : "font-bold text-subtle")}>
                  {w.answer ?? "No answer was written."}
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-black text-muted">
                    Marking points{editable ? " · tap the ones the answer meets" : ""}
                  </span>
                  {w.markingPoints.length === 0 && <span className="text-sm font-bold text-muted">No marking points were set for this question.</span>}
                  {w.markingPoints.map((text, i) => {
                    const on = s.ticks.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={!editable}
                        onClick={() => {
                          const ticks = on ? s.ticks.filter((t) => t !== i) : [...s.ticks, i];
                          patch(w.questionId, { ticks, mark: Math.min(ticks.length, w.points) });
                        }}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left text-sm font-bold leading-snug transition",
                          on ? "border-mint-ink bg-[#effbf5] text-mint-deep" : "border-line-input bg-white text-[#2c3140]",
                          editable && !on && "hover:bg-paper",
                        )}
                      >
                        <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-lg", on ? "bg-mint-ink text-white" : "bg-chip text-transparent")}>
                          <Check className="size-[13px]" strokeWidth={3.6} />
                        </span>
                        <span className="flex-1">{text}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-end gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-black">Mark</span>
                    <div className="flex h-12 items-center gap-1.5 rounded-full bg-secondary-soft px-1.5">
                      <button
                        type="button"
                        aria-label="One mark less"
                        disabled={!editable || s.mark <= 0}
                        onClick={() => patch(w.questionId, { mark: s.mark - 1 })}
                        className="grid size-9 place-items-center rounded-full bg-white disabled:opacity-40"
                      >
                        <Minus className="size-[18px]" strokeWidth={3} aria-hidden />
                      </button>
                      <span aria-live="polite" className="min-w-14 text-center text-lg font-black text-secondary-dark">
                        {s.mark} / {w.points}
                      </span>
                      <button
                        type="button"
                        aria-label="One mark more"
                        disabled={!editable || s.mark >= w.points}
                        onClick={() => patch(w.questionId, { mark: s.mark + 1 })}
                        className="grid size-9 place-items-center rounded-full bg-white disabled:opacity-40"
                      >
                        <Plus className="size-[18px]" strokeWidth={3} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <label className="flex min-w-60 flex-1 flex-col gap-1.5 text-[13px] font-black">
                    Feedback for {data.firstName}
                    <input
                      className={cn(inputClass, "rounded-full text-sm font-semibold")}
                      value={s.feedback}
                      disabled={!editable}
                      placeholder="What they did well, and one thing to improve"
                      onChange={(e) => patch(w.questionId, { feedback: e.target.value })}
                    />
                  </label>
                </div>
              </Card>
            );
          })}

          <section className="flex flex-col gap-3.5 rounded-[28px] bg-ink p-[22px] text-white">
            <label className="flex flex-col gap-1.5 text-sm font-black">
              Overall comment
              <textarea
                className={cn(textareaClass, "border-0 bg-[#2c3242] text-sm text-white placeholder:text-[#9aa0ae] focus:ring-secondary-ring/40")}
                rows={2}
                value={overall}
                disabled={!editable}
                placeholder="A short note to the student"
                onChange={(e) => setOverall(e.target.value)}
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3.5">
              <div className="flex items-center gap-3.5">
                <GradeTile grade={grade} size="md" className="size-14 rounded-[18px] text-[28px]" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-[22px] font-black">
                    {total} / {data.totalMarks} · {pct}%
                  </span>
                  <span className="text-[13px] font-bold text-[#c8cbd4]">
                    Auto {data.objectiveScore} + written {writtenTotal}
                  </span>
                </div>
              </div>
              {editable && (
                <Button size="lg" onClick={() => void save()} loading={saving}>
                  Save marks
                </Button>
              )}
            </div>
            {problem && <Notice variant="error">{problem}</Notice>}
            <span className="text-xs font-bold text-[#c8cbd4]">{data.firstName} sees this only after you release results for this class.</span>
          </section>
        </div>
      </div>
    </>
  );
}
