"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  closed: {
    title: () => "Your exam was handed in",
    text: "Your teacher closed the exam, so it was submitted with everything you had saved.",
    how: "When your teacher closed it",
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
      <main className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col justify-center gap-4 px-4 py-8 md:min-h-[calc(100dvh-73px)] md:px-7 md:py-10">
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

/** Brand-friendly confetti colours: the question-kind pastels' strong tones plus warm accents. */
const CONFETTI_COLORS = ["#015746", "#5236d6", "#b3245f", "#1e62b8", "#f2b53a", "#ff9f6b"];

function SubmittedContent({ data }: { data: SubmittedSummary }) {
  const text = copy[data.reason];
  const tile = useRef<HTMLSpanElement>(null);

  // Real confetti, once per submission, and only when the student handed it in themselves
  // (it would be tone-deaf after "Time's up" or a violation). Skipped for reduced motion.
  useEffect(() => {
    if (data.reason !== "manual") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // keyed on the submission time too: attempt numbers restart whenever the demo data resets
    const key = `ll.confetti.${data.attemptId}.${data.submittedAt}`;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      // storage blocked: just celebrate
    }

    let cancelled = false;
    void import("canvas-confetti").then(({ default: confetti }) => {
      if (cancelled) return;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        // ignore
      }
      const rect = tile.current?.getBoundingClientRect();
      const origin = rect
        ? { x: (rect.left + rect.width / 2) / window.innerWidth, y: (rect.top + rect.height / 2) / window.innerHeight }
        : { x: 0.5, y: 0.4 };
      const base = { colors: CONFETTI_COLORS, ticks: 200, gravity: 0.95, scalar: 1.05, disableForReducedMotion: true };
      confetti({ ...base, particleCount: 80, spread: 80, startVelocity: 42, origin });
      window.setTimeout(() => {
        confetti({ ...base, particleCount: 45, angle: 60, spread: 65, startVelocity: 48, origin: { x: 0, y: 0.7 } });
        confetti({ ...base, particleCount: 45, angle: 120, spread: 65, startVelocity: 48, origin: { x: 1, y: 0.7 } });
      }, 250);
    });
    return () => {
      cancelled = true;
    };
  }, [data.reason, data.attemptId, data.submittedAt]);

  return (
    <>
      <Card className="flex flex-col items-center gap-[18px] rounded-[30px] px-[22px] py-7 text-center md:gap-6 md:rounded-[32px] md:p-10">
        <motion.span
          ref={tile}
          initial={{ scale: 0.5, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: -6, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16 }}
          className="relative mt-6 grid size-[88px] place-items-center rounded-[28px] bg-mint md:mt-2 md:size-[100px] md:rounded-[32px]"
        >
          <Image src="/tick-green.png" alt="" width={360} height={284} priority aria-hidden className="h-auto w-[62%]" />
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

        {/* desktop: inside the card. Visibility is on a wrapper, not the button, so the button's own display style can't override it. */}
        <div className="relative hidden md:block">
          <ButtonLink href="/student" className="md:px-[30px]">
            Back to my exams
          </ButtonLink>
        </div>
      </Card>

      {/* phones: below the card */}
      <div className="md:hidden">
        <ButtonLink href="/student" block>
          Back to my exams
        </ButtonLink>
      </div>

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
