"use client";

import Link from "next/link";
import { ArrowRight, Clock, FileText, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import type { ExamCard, ResultSummary, StudentHome as StudentHomeData } from "@/lib/api-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { KIND_META, KIND_ORDER } from "@/lib/question-kinds";
import type { QuestionKind } from "@/lib/types";
import { plural } from "@/lib/utils";
import { AccountButton, StudentShell } from "@/components/student/StudentShell";
import { LiveClock } from "@/components/student/LiveClock";
import { ButtonLink, Card, Chip, EmptyState, ErrorState, GradeTile, Skeleton } from "@/components/ui";

const inlineKind: Record<QuestionKind, string> = {
  mcq: "multiple choice",
  true_false: "true or false",
  fill_blank: "fill in the blank",
  written: "written",
};

const kindChipTone = { mcq: "lilac", true_false: "sky", fill_blank: "mint", written: "peach" } as const;

export function StudentHomeScreen() {
  const { data, error, loading, reload, refresh } = useAsync(() => api.student.home(), []);

  return (
    <StudentShell active="exams" bottomNav>
      <main className="mx-auto w-full max-w-[1140px] px-4 pb-8 pt-5 md:px-7 md:pb-12 md:pt-9">
        {loading && <HomeSkeleton />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} />}
        {data && <HomeContent data={data} onChange={refresh} />}
      </main>
    </StudentShell>
  );
}

function HomeContent({ data, onChange }: { data: StudentHomeData; onChange: () => void }) {
  const { student, open, inProgress, newResults } = data;
  const nothingToDo = open.length === 0 && inProgress.length === 0;
  const openCount = open.length + inProgress.length;

  return (
    <div className="flex flex-col gap-6 md:gap-7">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 md:gap-1">
          <h1 className="text-[28px] font-black leading-tight md:text-4xl">Hi {student.firstName}!</h1>
          <p className="text-sm font-bold text-muted md:text-base">
            {student.className}
            {openCount > 0 && <span className="hidden md:inline"> · You have {plural(openCount, "exam")} open right now.</span>}
          </p>
        </div>
        <AccountButton className="md:hidden" />
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-5 md:gap-6">
          {open.map((card) => (
            <OpenExamCard key={card.sessionId} card={card} />
          ))}
          {nothingToDo && (
            <EmptyState title="No exams are open right now" Icon={FileText}>
              When your teacher opens one for your class, it will show up here.
            </EmptyState>
          )}
        </div>

        {(inProgress.length > 0 || newResults.length > 0) && (
          <aside className="flex flex-col gap-4 md:w-[340px] md:shrink-0 md:gap-[18px]">
            {inProgress.map((card) => (
              <InProgressCard key={card.sessionId} card={card} serverNow={data.serverNow} onExpired={onChange} />
            ))}
            {newResults.map((result) => (
              <NewResultCard key={result.attemptId} result={result} onDismissed={onChange} />
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

function OpenExamCard({ card }: { card: ExamCard }) {
  const kinds = KIND_ORDER.filter((k) => card.kindCounts[k] > 0);

  return (
    <Card className="flex flex-col gap-3.5 p-5 md:gap-5 md:rounded-[30px] md:p-8">
      <Chip tone="mint" size="lg" className="self-start">
        <span className="size-[7px] rounded-full bg-mint-ink md:size-2" aria-hidden />
        Open now
      </Chip>

      <div className="flex flex-col gap-1 md:gap-1.5">
        <h2 className="pr-7 text-[21px] font-black leading-tight md:pr-0 md:text-[28px]">{card.title}</h2>
        <p className="hidden text-[15px] font-bold text-muted md:block">
          {card.subjectName.replace(/^(IGCSE|IAL)\s+/i, "")} {card.subjectCode} · {card.teacher}
        </p>
        <p className="text-sm font-bold text-muted md:hidden">
          {card.timeLimitMinutes} min · {plural(card.questionCount, "question")} · {card.totalMarks} marks
        </p>
      </div>

      {/* phones: the four coloured squares hint at the question types */}
      <div className="flex items-center gap-1.5 md:hidden">
        {kinds.map((k) => (
          <span key={k} aria-hidden className={`size-[30px] rounded-[10px] ${KIND_META[k].bg}`} />
        ))}
        <span className="ml-1 text-[13px] font-extrabold text-muted">{plural(kinds.length, "question type")}</span>
      </div>

      {/* desktop: facts and a breakdown of what's inside */}
      <div className="hidden flex-wrap gap-2.5 md:flex">
        <Chip tone="neutral" size="lg" className="h-[38px] px-3.5 text-sm font-extrabold">
          <Clock className="size-4" strokeWidth={2.5} aria-hidden />
          {card.timeLimitMinutes} minutes
        </Chip>
        <Chip tone="neutral" size="lg" className="h-[38px] px-3.5 text-sm font-extrabold">
          {plural(card.questionCount, "question")}
        </Chip>
        <Chip tone="neutral" size="lg" className="h-[38px] px-3.5 text-sm font-extrabold">
          {card.totalMarks} marks
        </Chip>
      </div>
      <div className="hidden flex-wrap items-center gap-2 md:flex">
        <span className="mr-1 text-[13px] font-extrabold text-muted">Inside:</span>
        {kinds.map((k) => (
          <Chip key={k} tone={kindChipTone[k]} size="lg" className="font-extrabold">
            {card.kindCounts[k]} {inlineKind[k]}
          </Chip>
        ))}
      </div>

      <ButtonLink href={`/student/exams/${card.sessionId}`} block className="md:w-fit md:self-start md:px-7">
        Get started <ArrowRight className="size-5" aria-hidden />
      </ButtonLink>
    </Card>
  );
}

function InProgressCard({ card, serverNow, onExpired }: { card: ExamCard; serverNow: string; onExpired: () => void }) {
  return (
    <section className="flex flex-col gap-3 rounded-[26px] bg-amber p-[18px] md:p-[22px]">
      <Chip tone="white" size="lg" className="self-start text-amber-ink">
        In progress · <LiveClock deadlineAt={card.deadlineAt!} serverNow={serverNow} onExpired={onExpired} />
      </Chip>
      <h2 className="text-base font-black md:text-lg">{card.title}</h2>
      <p className="text-sm font-semibold leading-relaxed text-[#6b4a00]">
        Your answers are saved. The timer kept running while you were away.
      </p>
      <ButtonLink href={`/student/attempts/${card.attemptId}`} variant="dark" size="md" block>
        Continue
      </ButtonLink>
    </section>
  );
}

function NewResultCard({ result, onDismissed }: { result: ResultSummary; onDismissed: () => void }) {
  return (
    <Card className="flex flex-col gap-3.5 rounded-3xl p-4 md:rounded-[26px] md:p-5">
      <div className="flex items-center justify-between">
        <Chip tone="mint" size="lg">
          <Sparkles className="size-[13px]" fill="currentColor" aria-hidden />
          New result
        </Chip>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={async () => {
            await api.student.dismissNewResult(result.attemptId).catch(() => undefined);
            onDismissed();
          }}
          className="hidden size-8 place-items-center rounded-full bg-chip text-muted hover:bg-line md:grid"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <Link href={`/student/results/${result.attemptId}`} className="flex items-center gap-3.5 text-ink no-underline hover:text-ink">
        <GradeTile grade={result.grade} size="md" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[15px] font-black leading-snug md:text-base">{result.title}</span>
          <span className="text-sm font-bold text-muted">
            {result.score} / {result.total} · {result.percent}%
          </span>
        </div>
      </Link>
      <ButtonLink href={`/student/results/${result.attemptId}`} variant="soft" size="md" block>
        See feedback <ArrowRight className="size-5" aria-hidden />
      </ButtonLink>
    </Card>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading your exams">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="flex flex-col gap-5 md:flex-row">
        <Skeleton className="h-64 flex-1 rounded-[28px]" />
        <Skeleton className="h-48 rounded-[26px] md:w-[340px]" />
      </div>
    </div>
  );
}

