"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CloudCheck, FileText, MonitorX, Timer, type LucideIcon } from "lucide-react";
import { api, toApiError } from "@/lib/api";
import type { CoverData } from "@/lib/api-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn } from "@/lib/utils";
import { StudentShell } from "@/components/student/StudentShell";
import { Button, Card, ErrorState, Notice, Skeleton } from "@/components/ui";

const ruleStyle: Record<string, { Icon: LucideIcon; tone: string }> = {
  violations: { Icon: MonitorX, tone: "bg-peach text-peach-ink" },
  autosave: { Icon: CloudCheck, tone: "bg-mint text-mint-ink" },
  timer: { Icon: Timer, tone: "bg-brand-tint text-brand" },
};

export function CoverScreen() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = Number(params.sessionId);
  const { data, error, loading, reload } = useAsync(() => api.student.cover(sessionId), [sessionId]);

  return (
    <StudentShell active="exams">
      <main className="mx-auto flex w-full max-w-[900px] flex-col gap-3 px-4 pb-6 pt-2.5 md:gap-5 md:px-7 md:pb-12 md:pt-7">
        <Link
          href="/student"
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-[15px] font-extrabold no-underline"
        >
          <ArrowLeft className="size-[18px]" aria-hidden /> My exams
        </Link>

        {loading && <CoverSkeleton />}
        {error && (
          <ErrorState
            code={error.code}
            message={error.message}
            onRetry={error.code === "network" ? reload : undefined}
            backHref={error.code === "conflict" ? "/student/results" : "/student"}
            backLabel={error.code === "conflict" ? "See my results" : "Back to my exams"}
          />
        )}
        {data && <CoverContent data={data} />}
      </main>
    </StudentShell>
  );
}

function CoverContent({ data }: { data: CoverData }) {
  const router = useRouter();
  const checkId = useId();
  const [agreed, setAgreed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // Already started: skip the cover and go straight back in.
  useEffect(() => {
    if (data.resumeAttemptId) router.replace(`/student/attempts/${data.resumeAttemptId}`);
  }, [data.resumeAttemptId, router]);

  async function start() {
    setStarting(true);
    setStartError(null);
    try {
      const { attemptId } = await api.student.start(data.sessionId);
      router.push(`/student/attempts/${attemptId}`);
    } catch (e) {
      setStartError(toApiError(e).message);
      setStarting(false);
    }
  }

  if (data.resumeAttemptId) {
    return (
      <p role="status" className="py-16 text-center font-bold text-muted">
        Taking you back to your exam…
      </p>
    );
  }

  const subject = data.subjectName.replace(/^(IGCSE|IAL)\s+/i, "");

  return (
    <>
      <Card className="flex flex-col gap-3.5 p-5 md:gap-[26px] md:rounded-[30px] md:p-[34px]">
        <div className="flex max-w-xl flex-col gap-1 pr-10 md:gap-1.5 md:pr-0">
          <p className="text-[13px] font-extrabold text-brand md:text-sm">
            {subject} {data.subjectCode} · {data.teacher}
          </p>
          <h1 className="text-[23px] font-black leading-tight md:text-4xl md:leading-[1.15]">{data.title}</h1>
        </div>

        <div className="grid grid-cols-3 gap-2 md:gap-3.5">
          <Stat
            value={`${data.timeLimitMinutes} min`}
            label="Time limit"
            tone="bg-brand-tint"
            ink="text-brand-dark"
            sub="text-brand-mid"
            icon="/clock-green.png"
          />
          <Stat
            value={String(data.questionCount)}
            label={data.freeNavigation ? "Questions, any order" : "Questions"}
            tone="bg-sky"
            ink="text-sky-deep"
            sub="text-[#1e4f86]"
            icon="/question-blue.png"
          />
          <Stat
            value={String(data.totalMarks)}
            label="Marks"
            tone="bg-mint"
            ink="text-mint-deep"
            sub="text-[#155e3b]"
            icon="/star-green.png"
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-2.5 rounded-[26px] p-4 md:gap-3 md:rounded-[30px] md:p-[34px] md:pt-7">
        <h2 className="text-[17px] font-black md:text-xl">Before you start</h2>
        <ul className="flex flex-col gap-2.5 md:gap-3">
          {data.globalRules.map((rule) => {
            const { Icon, tone } = ruleStyle[rule.id] ?? ruleStyle.timer;
            return (
              <li key={rule.id} className="flex items-start gap-2.5 md:gap-3.5 md:rounded-[20px] md:bg-paper md:px-4 md:py-3.5">
                <span className={cn("grid size-8 shrink-0 place-items-center rounded-[11px] md:size-10 md:rounded-[13px]", tone)}>
                  <Icon className="size-4 md:size-5" strokeWidth={2.4} aria-hidden />
                </span>
                <p className="text-[13px] font-semibold leading-[1.45] md:text-[15px] md:leading-normal">{rule.text}</p>
              </li>
            );
          })}
        </ul>
      </Card>

      {data.examRules.trim() && (
        <section className="flex items-start gap-3.5 rounded-[22px] bg-peach-soft px-4 py-3.5 md:px-5 md:py-[18px]">
          <span className="hidden size-10 shrink-0 place-items-center rounded-[13px] bg-peach-mid text-peach-ink md:grid">
            <FileText className="size-5" strokeWidth={2.2} aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-black text-peach-deep md:text-base">From {data.teacher}</h2>
            <p className="text-[13px] font-semibold leading-[1.45] text-peach-text md:text-[15px]">{data.examRules}</p>
          </div>
        </section>
      )}

      {startError && (
        <Notice variant="error" title="We couldn't start your exam" action={undefined}>
          {startError} Your timer has not started.
        </Notice>
      )}

      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col gap-2 border-t border-line-header bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5",
          "md:static md:mx-0 md:mt-0 md:flex-row md:items-center md:justify-between md:gap-4 md:rounded-[26px] md:border md:border-line md:p-[18px_22px]",
        )}
      >
        <label htmlFor={checkId} className="flex min-h-10 cursor-pointer items-center gap-2.5 text-sm font-extrabold md:min-h-11 md:gap-3 md:text-[15px]">
          <input
            id={checkId}
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="size-[22px] accent-secondary"
          />
          I&apos;ve read the rules and I&apos;m ready
        </label>
        <Button onClick={start} disabled={!agreed} loading={starting} block className="md:w-auto md:px-7">
          {starting ? "Starting…" : "Start exam · timer begins"}
          {!starting && <ArrowRight className="hidden size-5 md:block" aria-hidden />}
        </Button>
      </div>
    </>
  );
}

function Stat({ value, label, tone, ink, sub, icon }: { value: string; label: string; tone: string; ink: string; sub: string; icon?: string }) {
  return (
    <div className={cn("bg-fabric relative flex flex-col overflow-hidden rounded-[18px] p-3 md:gap-1 md:rounded-[22px] md:p-[18px]", tone)}>
      {/* watermark: sits behind the text, cropped by the tile's corner */}
      {icon && (
        <Image
          src={icon}
          alt=""
          width={256}
          height={256}
          aria-hidden
          className="pointer-events-none absolute -bottom-3 -right-3 size-[72px] opacity-[0.12] md:-bottom-4 md:-right-4 md:size-28 md:opacity-25"
        />
      )}
      <span className={cn("relative text-[21px] font-black leading-tight md:text-[30px]", ink)}>{value}</span>
      <span className={cn("relative text-xs font-bold leading-tight md:text-sm", sub)}>{label}</span>
    </div>
  );
}

function CoverSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading exam details">
      <Skeleton className="h-48 rounded-[28px]" />
      <Skeleton className="h-56 rounded-[26px]" />
    </div>
  );
}
