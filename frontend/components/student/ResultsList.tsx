"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Hourglass, Trophy } from "lucide-react";
import { api } from "@/lib/api";
import type { ResultListItem, StudentResults, SubjectResults } from "@/lib/api-types";
import { GRADE_BANDS, type Grade } from "@/lib/grading";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, formatDate } from "@/lib/utils";
import { AccountButton, StudentShell } from "@/components/student/StudentShell";
import { Card, Chip, EmptyState, ErrorState, GradeTile, ProgressBar, Skeleton } from "@/components/ui";

type Released = Extract<ResultListItem, { kind: "released" }>;
type Pending = Extract<ResultListItem, { kind: "pending" }>;

const rank = (g: Grade) => GRADE_BANDS.length - GRADE_BANDS.findIndex((b) => b.grade === g);

export function ResultsListScreen() {
  const { data, error, loading, reload } = useAsync(() => api.student.results(), []);

  return (
    <StudentShell active="results" bottomNav>
      <main className="mx-auto w-full max-w-[1140px] px-4 pb-8 pt-5 md:px-7 md:pb-12 md:pt-9">
        {loading && <ListSkeleton />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} />}
        {data && <ListContent data={data} />}
      </main>
    </StudentShell>
  );
}

function ListContent({ data }: { data: StudentResults }) {
  const [filter, setFilter] = useState<string>("all");
  const subjects = filter === "all" ? data.subjects : data.subjects.filter((s) => s.subjectCode === filter);

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5 md:gap-1">
          <h1 className="text-[28px] font-black leading-tight md:text-4xl">Your results</h1>
          <p className="text-sm font-bold text-muted md:text-base">
            <span className="md:hidden">Released by your teachers, by subject</span>
            <span className="hidden md:inline">Everything your teachers have released, by subject.</span>
          </p>
        </div>
        <AccountButton className="md:hidden" />
      </div>

      {data.subjects.length === 0 ? (
        <EmptyState title="No results yet" Icon={Trophy}>
          When your teacher releases a result, it will show up here.
        </EmptyState>
      ) : (
        <>
          {data.subjects.length > 1 && (
            <nav aria-label="Subjects" className="-mt-1 hidden flex-wrap gap-2 md:flex">
              {[{ code: "all", label: "All subjects" }, ...data.subjects.map((s) => ({ code: s.subjectCode, label: s.subjectShort }))].map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => setFilter(s.code)}
                  aria-pressed={filter === s.code}
                  className={cn(
                    "h-[42px] rounded-full px-[18px] text-sm font-extrabold transition",
                    filter === s.code ? "bg-ink text-white" : "border-2 border-line-input bg-white text-ink hover:bg-paper",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )}

          <Overview data={data} subjects={subjects} />

          {subjects.map((subject) => (
            <section key={subject.subjectCode} className="flex flex-col gap-3 md:gap-3.5" aria-labelledby={`subject-${subject.subjectCode}`}>
              <div className="flex items-center gap-2 md:gap-3">
                <h2 id={`subject-${subject.subjectCode}`} className="text-lg font-black md:text-[21px]">
                  {subject.subjectName}
                </h2>
                <Chip tone="neutral" size="md" className="md:px-2.5 md:text-[13px]">
                  {subject.subjectCode}
                </Chip>
              </div>
              {subject.items.map((item) => (item.kind === "released" ? <ReleasedRow key={item.attemptId} item={item} /> : <PendingRow key={item.attemptId} item={item} />))}
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function Overview({ data, subjects }: { data: StudentResults; subjects: SubjectResults[] }) {
  const progress = subjects
    .map((s) => {
      const released = s.items.filter((i): i is Released => i.kind === "released");
      return { subject: s, latest: released[0] };
    })
    .filter((x): x is { subject: SubjectResults; latest: Released } => !!x.latest);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-5">
      {/* tiles: desktop only */}
      <div className="hidden max-w-[360px] flex-1 basis-[300px] grid-cols-2 gap-3 md:grid">
        <div className="flex flex-col gap-0.5 rounded-3xl bg-brand-tint p-[18px]">
          <span className="text-3xl font-black text-brand-dark">{data.releasedCount}</span>
          <span className="text-sm font-extrabold text-brand-mid">Results released</span>
        </div>
        <div className="flex flex-col gap-0.5 rounded-3xl bg-amber p-[18px]">
          <span className="text-3xl font-black text-amber-ink">{data.pendingCount}</span>
          <span className="text-sm font-extrabold text-[#7a4d00]">Being marked</span>
        </div>
        {data.latest && (
          <Card className="col-span-2 flex items-center gap-3.5 rounded-3xl p-[18px]">
            <GradeTile grade={data.latest.grade} size="md" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-extrabold text-muted">Latest grade · {data.latest.subjectShort}</span>
              <span className="text-base font-black">
                {data.latest.title} · {data.latest.percent}%
              </span>
            </div>
          </Card>
        )}
      </div>

      {progress.length > 0 && (
        <Card className="flex flex-1 basis-[480px] flex-col gap-3 rounded-3xl p-[18px] md:gap-4 md:rounded-[28px] md:p-6">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[17px] font-black md:text-[19px]">How you&apos;re doing</h2>
            <p className="hidden text-sm font-bold text-muted md:block">Your latest grade in each subject.</p>
          </div>
          <ul className="flex flex-col gap-3 md:gap-3.5">
            {progress.map(({ subject, latest }) => (
              <li key={subject.subjectCode} className="flex items-center gap-3.5">
                <GradeTile grade={latest.grade} size="sm" tone="tint" className="hidden md:grid" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex justify-between gap-3 text-[13px] font-extrabold md:text-sm">
                    <span className="min-w-0 truncate">
                      <span className="hidden md:inline">{subject.subjectShort} · </span>
                      {latest.title}
                    </span>
                    <span className="shrink-0">
                      <span className="md:hidden">{latest.grade} · </span>
                      {latest.percent}% <Trend item={latest} />
                    </span>
                  </div>
                  <ProgressBar value={latest.percent} label={`${latest.title}: ${latest.percent}%`} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Trend({ item }: { item: Released }) {
  if (!item.previousGrade) return <span className="hidden font-bold text-mint-deep md:inline">first result</span>;
  const diff = rank(item.grade) - rank(item.previousGrade);
  if (diff === 0) return <span className="hidden font-bold text-muted md:inline">same grade</span>;
  return diff < 0 ? (
    <span className="hidden font-bold text-peach-ink md:inline">↓ from {item.previousGrade}</span>
  ) : (
    <span className="hidden font-bold text-mint-deep md:inline">↑ from {item.previousGrade}</span>
  );
}

function ReleasedRow({ item }: { item: Released }) {
  return (
    <Link
      href={`/student/results/${item.attemptId}`}
      className="flex items-center gap-3.5 rounded-3xl border border-line bg-white px-4 py-3.5 text-ink no-underline transition hover:border-brand/30 hover:text-ink hover:shadow-sm md:gap-[18px] md:px-5 md:py-[18px]"
    >
      <GradeTile grade={item.grade} size="md" tone="tint" className="md:size-[58px] md:rounded-[18px] md:text-[28px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-[3px]">
        <span className="text-[15px] font-black md:text-[17px]">{item.title}</span>
        <span className="text-[13px] font-bold text-muted md:text-sm">
          {item.score} / {item.total} · {item.percent}%<span className="hidden md:inline"> · Released {formatDate(item.releasedAt)}</span>
        </span>
      </div>
      {item.isNew && (
        <Chip tone="mint" size="md">
          New
        </Chip>
      )}
      <span className="hidden text-sm font-extrabold text-brand md:inline">See feedback →</span>
      <ArrowRight className="size-[18px] text-brand md:hidden" strokeWidth={3} aria-hidden />
    </Link>
  );
}

function PendingRow({ item }: { item: Pending }) {
  return (
    <div className="flex items-center gap-3.5 rounded-3xl border-2 border-dashed border-[#e0d9ce] bg-white px-4 py-3.5 md:gap-[18px] md:px-5 md:py-[18px]">
      <span aria-hidden className="grid size-[50px] shrink-0 place-items-center rounded-2xl bg-amber text-amber-ink md:size-[58px] md:rounded-[18px]">
        <Hourglass className="size-6" strokeWidth={2.4} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 md:gap-[3px]">
        <span className="text-[15px] font-black md:text-[17px]">{item.title}</span>
        <span className="text-[13px] font-bold text-muted md:text-sm">
          {item.stage === "marking"
            ? "Your teacher is marking it. It'll appear here once released."
            : "Marked. It'll appear here once your teacher releases it."}
        </span>
      </div>
      <Chip tone="amber" size="md">
        {item.stage === "marking" ? "Being marked" : "Almost there"}
      </Chip>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading your results">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-40 rounded-[28px]" />
      <Skeleton className="h-20 rounded-3xl" />
      <Skeleton className="h-20 rounded-3xl" />
    </div>
  );
}
