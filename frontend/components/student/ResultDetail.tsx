"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import type { ResultDetail, ResultQuestion } from "@/lib/api-types";
import { GRADE_BANDS, marksToNextGrade } from "@/lib/grading";
import { useAsync } from "@/lib/hooks/useAsync";
import { KIND_META } from "@/lib/question-kinds";
import { cn, plural } from "@/lib/utils";
import { StudentShell } from "@/components/student/StudentShell";
import { Card, ErrorState, GradeTile, ProgressBar, Skeleton } from "@/components/ui";

const ticks = GRADE_BANDS.filter((b) => b.min > 0);

function listPositions(nums: number[]): string {
  const labels = nums.map((n) => `Q${n}`);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function ResultDetailScreen() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = Number(params.attemptId);
  const { data, error, loading, reload } = useAsync(() => api.student.result(attemptId), [attemptId]);

  return (
    <StudentShell active="results">
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-3 px-4 pb-10 pt-2 md:gap-[22px] md:px-7 md:pt-7">
        <Link href="/student/results" className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-extrabold no-underline">
          <ArrowLeft className="size-[18px]" aria-hidden /> All results
        </Link>
        {loading && (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your result">
            <Skeleton className="h-44 rounded-[28px]" />
            <Skeleton className="h-24 rounded-3xl" />
          </div>
        )}
        {error && (
          <ErrorState
            code={error.code}
            message={error.message}
            onRetry={error.code === "network" ? reload : undefined}
            backHref="/student/results"
            backLabel="Back to my results"
          />
        )}
        {data && <Content data={data} />}
      </main>
    </StudentShell>
  );
}

function Content({ data }: { data: ResultDetail }) {
  const next = marksToNextGrade(data.score, data.total);
  const blanks = data.questions.filter((q) => q.yourAnswer == null).map((q) => q.position);

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-5">
        <Card className="flex flex-col gap-3 p-[18px] md:flex-1 md:basis-[520px] md:justify-center md:gap-3 md:rounded-[30px] md:p-[30px]">
          <div className="flex flex-wrap items-center gap-4 md:gap-7">
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 240, damping: 15 }}>
              <GradeTile grade={data.grade} size="lg" className="md:hidden" />
              <GradeTile grade={data.grade} size="xl" className="hidden md:grid" />
            </motion.div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:min-w-[260px] md:gap-2.5">
              <p className="text-xs font-extrabold text-brand md:text-sm">{data.title}</p>
              <p className="flex items-baseline gap-3">
                <span className="text-[32px] font-black leading-tight md:text-[44px]">
                  {data.score} / {data.total}
                </span>
                <span className="text-[15px] font-extrabold text-muted md:text-[22px] md:font-extrabold">{data.percent}%</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <ProgressBar value={data.percent} ticks={ticks.map((t) => t.min)} className="h-3 md:h-3.5" label={`Score ${data.percent}%`} />
            <div aria-hidden className="relative hidden h-4 text-xs font-extrabold text-muted md:block">
              {ticks.map((t) => (
                <span key={t.grade} className="absolute -translate-x-1/2" style={{ left: `${t.min}%` }}>
                  {t.grade}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-[13px] font-bold text-ink-2 md:text-sm">
            {next && next.marksNeeded <= 3 && (
              <p>
                {next.marksNeeded === 1 ? "One more mark" : `${next.marksNeeded} more marks`} would have reached a {next.grade} at {next.minPercent}%.
              </p>
            )}
            {blanks.length > 0 && (
              <p>
                {listPositions(blanks)} {blanks.length === 1 ? "was" : "were"} left blank. Worth a look.
              </p>
            )}
          </div>
        </Card>

        {data.overallComment && (
          <section className="flex flex-col gap-3 rounded-[22px] bg-peach-soft p-4 md:flex-1 md:basis-[300px] md:rounded-[30px] md:p-[26px]">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="grid size-[34px] shrink-0 place-items-center rounded-full bg-peach-mid text-xs font-black text-[#8a3409] md:size-10 md:text-sm">
                {data.teacherInitials}
              </span>
              <div className="flex flex-col">
                <h2 className="text-[13px] font-black text-peach-deep md:text-[15px]">{data.teacher}</h2>
                <p className="hidden text-xs font-bold text-[#8a4a26] md:block">Overall comment</p>
              </div>
            </div>
            <p className="text-sm font-semibold leading-[1.45] text-[#5a2a10] md:text-base md:leading-[1.55]">{data.overallComment}</p>
          </section>
        )}
      </div>

      <section className="mt-1 flex flex-col gap-2.5 md:mt-0 md:gap-3.5" aria-labelledby="by-question">
        <h2 id="by-question" className="text-[17px] font-black md:text-[22px]">
          Question by question
        </h2>
        <ul className="grid gap-1.5 md:grid-cols-2 md:gap-3.5">
          {data.questions.map((q) => (
            <QuestionRow key={q.position} q={q} />
          ))}
        </ul>
      </section>
    </>
  );
}

function marksTone(q: ResultQuestion) {
  if (q.awarded >= q.points) return "bg-mint text-mint-deep";
  if (q.awarded === 0) return "bg-rose text-rose-ink";
  return "bg-amber text-amber-ink";
}

/** Compact row on phones (tap to expand), full card on desktop. */
function QuestionRow({ q }: { q: ResultQuestion }) {
  const [open, setOpen] = useState(false);
  const meta = KIND_META[q.kind];
  const bodyId = `q-${q.position}-details`;

  return (
    <li className="rounded-2xl border border-line bg-white md:rounded-3xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex min-h-11 w-full items-center gap-2.5 py-1.5 pl-1.5 pr-2.5 text-left md:pointer-events-none md:min-h-0 md:gap-2.5 md:px-5 md:pb-0 md:pt-[18px]"
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-[11px] text-sm font-black md:h-8 md:w-auto md:px-[11px]", meta.bg, meta.fg)}>
          <span className="md:hidden">{q.position}</span>
          <span className="hidden md:inline">Q{q.position}</span>
        </span>
        <span className="flex-1 text-sm font-extrabold md:font-extrabold md:text-muted">
          {meta.label}
          <span className="sr-only">, {plural(q.awarded, "mark")} out of {q.points}</span>
        </span>
        <span aria-hidden className={cn("rounded-full px-2.5 py-1 text-[13px] font-black md:px-3 md:py-[5px] md:text-sm", marksTone(q))}>
          {q.awarded} / {q.points}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-subtle transition md:hidden", open && "rotate-180")} aria-hidden />
      </button>

      <div id={bodyId} className={cn("flex-col gap-2.5 px-3 pb-3.5 pt-1.5 md:flex md:px-5 md:pb-[18px] md:pt-2.5", open ? "flex" : "hidden")}>
        <Details q={q} />
      </div>
    </li>
  );
}

function Details({ q }: { q: ResultQuestion }) {
  const wrong = q.awarded < q.points;

  if (q.kind === "written") {
    return (
      <>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-extrabold text-muted">Your answer</p>
          <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-ink-2">{q.yourAnswer ?? "Not answered"}</p>
        </div>
        {q.feedback && (
          <div className="flex flex-col gap-1 rounded-2xl bg-peach-soft p-3">
            <p className="text-xs font-extrabold text-peach-deep">Feedback</p>
            <p className="text-sm font-semibold leading-relaxed text-peach-text">{q.feedback}</p>
          </div>
        )}
      </>
    );
  }

  const label = q.kind === "fill_blank" ? "Accepted" : "Correct answer";
  return (
    <p className="text-sm font-bold leading-snug text-ink-2">
      {q.yourAnswer == null ? "Not answered" : `Your answer: ${q.yourAnswer}`}
      {wrong && q.correctAnswer && (
        <>
          {" · "}
          <span className="text-mint-deep">
            {label}: {q.correctAnswer}
          </span>
        </>
      )}
    </p>
  );
}
