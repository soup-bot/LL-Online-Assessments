"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { api } from "@/lib/api";
import type { SubmittedSummary } from "@/lib/api-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, formatTime } from "@/lib/utils";
import { StudentShell } from "@/components/student/StudentShell";
import { ButtonLink, Card, ErrorState, Skeleton } from "@/components/ui";

const copy = {
  manual: { title: (n: string) => `Nice work, ${n}!`, text: "Your exam is in. Time to take a breather.", how: "By you" },
  timeout: {
    title: () => "Time's up!",
    text: "Your exam was submitted with everything you had saved.",
    how: "When time ran out",
  },
  violations: {
    title: () => "Your exam was handed in",
    text: "You left the exam window 3 times, so it was submitted automatically. Your teacher can see this.",
    how: "After 3 violations",
  },
} as const;

export function SubmittedScreen() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = Number(params.attemptId);
  const { data, error, loading, reload } = useAsync(() => api.student.submitted(attemptId), [attemptId]);

  return (
    <StudentShell active="exams">
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 pb-8 pt-5 md:px-7 md:pt-10">
        {loading && <Skeleton className="h-[28rem] rounded-[30px]" />}
        {error && (
          <ErrorState
            code={error.code}
            message={error.message}
            onRetry={error.code === "network" ? reload : undefined}
            backHref="/student"
          />
        )}
        {data && <SubmittedContent data={data} />}
      </main>
    </StudentShell>
  );
}

const confetti = [
  "left-10 top-10 size-3 rounded-full bg-[#d9cfff]",
  "left-[86px] top-[110px] size-2.5 rotate-[20deg] rounded-[3px] bg-[#bfdfff]",
  "right-[50px] top-[46px] size-3.5 -rotate-[15deg] rounded bg-[#ffd0b5]",
  "right-[90px] top-[120px] size-[9px] rounded-full bg-[#b8efd3]",
  "left-[150px] top-[26px] size-[9px] rounded-full bg-[#ffe08a]",
  "right-[60px] top-[190px] hidden size-3 rounded-full bg-[#d9cfff] md:block",
];

function SubmittedContent({ data }: { data: SubmittedSummary }) {
  const text = copy[data.reason];
  const writtenDone = !data.awaitingMarking;

  const steps: { label: string; state: "done" | "pending" | "waiting" }[] = [
    { label: "Quick questions marked automatically", state: "done" },
    {
      label: writtenDone ? "No written answers left for your teacher to mark" : `${data.teacher} marks your written answers`,
      state: writtenDone ? "done" : "pending",
    },
    {
      label: data.resultsReleased ? "Your results are ready" : "Results appear on your exams page",
      state: data.resultsReleased ? "done" : "waiting",
    },
  ];

  return (
    <>
      <Card className="flex flex-col items-center gap-[18px] rounded-[30px] px-[22px] py-7 text-center md:gap-6 md:rounded-[32px] md:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {confetti.map((c) => (
            <span key={c} className={cn("absolute", c)} />
          ))}
        </div>

        <motion.span
          initial={{ scale: 0.5, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: -6, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="relative mt-6 grid size-[84px] place-items-center rounded-[28px] bg-mint text-mint-ink md:mt-2 md:size-[92px] md:rounded-[30px]"
        >
          <Check className="size-[42px] md:size-[46px]" strokeWidth={2.8} aria-hidden />
        </motion.span>

        <div className="relative flex flex-col gap-1.5 md:gap-2">
          <h1 className="text-[30px] font-black leading-tight md:text-4xl">{text.title(data.student.firstName)}</h1>
          <p className="text-base font-semibold text-ink-2 md:text-[17px]">{text.text}</p>
        </div>

        <dl className="relative grid w-full grid-cols-2 gap-2 text-left md:grid-cols-3 md:gap-2.5">
          <Fact label="Submitted" value={formatTime(data.submittedAt)} />
          <Fact label="Handed in" value={text.how} className="hidden md:flex" />
          <Fact label="Answered" value={`${data.answered} of ${data.questionCount}`} />
        </dl>

        <div className="relative flex w-full flex-col gap-2.5 text-left">
          <h2 className="text-base font-black md:text-[17px]">What happens next</h2>
          <ol className="flex flex-col gap-2.5 md:gap-3">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5 md:gap-3">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full md:size-[30px]",
                    s.state === "done" && "bg-brand text-white",
                    s.state === "pending" && "border-2 border-amber-line bg-amber",
                    s.state === "waiting" && "bg-chip",
                  )}
                >
                  {s.state === "done" && <Check className="size-3.5 md:size-[15px]" strokeWidth={3.2} />}
                </span>
                <span className={cn("text-sm font-bold md:text-[15px]", s.state === "waiting" && "text-muted")}>
                  {s.label}
                  <span className="sr-only">
                    {s.state === "done" ? " (done)" : s.state === "pending" ? " (in progress)" : " (not yet)"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        <ButtonLink href="/student" className="relative hidden md:inline-flex md:px-[30px]">
          Back to my exams
        </ButtonLink>
      </Card>

      <ButtonLink href="/student" block className="md:hidden">
        Back to my exams
      </ButtonLink>

      {data.resultsReleased && (
        <p className="text-center text-sm font-bold">
          <Link href="/student/results">See your results</Link>
        </p>
      )}
    </>
  );
}

function Fact({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-[18px] bg-paper p-3 md:rounded-[20px] md:p-3.5", className)}>
      <dt className="text-xs font-bold text-muted md:text-[13px]">{label}</dt>
      <dd className="text-base font-black md:text-[17px]">{value}</dd>
    </div>
  );
}
