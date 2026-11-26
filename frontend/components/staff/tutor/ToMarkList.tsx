"use client";

import Link from "next/link";
import { ArrowRight, PartyPopper } from "lucide-react";
import { tutorApi } from "@/lib/api-staff";
import { useAsync } from "@/lib/hooks/useAsync";
import { formatTime, plural } from "@/lib/utils";
import { PageHeader } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";

export function ToMarkScreen() {
  const { data, error, loading, reload } = useAsync(() => tutorApi.toMark(), []);
  return (
    <>
      <StaffMain>
        <PageHeader title="To mark" subtitle="Submissions with written answers waiting for you, oldest first." />
        {loading && <Skeleton className="h-52 rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/tutor" backLabel="Back to my exams" />}
        {data && data.length === 0 && (
          <EmptyState title="All caught up" Icon={PartyPopper}>
            Nothing is waiting to be marked.
          </EmptyState>
        )}
        {data && data.length > 0 && (
          <ul className="flex flex-col gap-3">
            {data.map((item) => (
              <li key={item.attemptId}>
                <Link href={`/tutor/attempts/${item.attemptId}`} className="block text-ink no-underline hover:text-ink">
                  <Card className="flex items-center gap-4 rounded-3xl px-5 py-4 transition hover:border-secondary/30 hover:shadow-sm">
                    <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-mint text-sm font-black text-mint-deep">
                      {item.student.initials}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-base font-black">{item.student.name}</span>
                      <span className="truncate text-[13px] font-bold text-muted">
                        {item.examTitle} · {item.className.split(",")[1]?.trim() ?? item.className} · handed in {formatTime(item.submittedAt)}
                      </span>
                    </div>
                    <span className="hidden text-sm font-extrabold text-muted sm:inline">{plural(item.writtenCount, "written answer")}</span>
                    <ArrowRight className="size-[18px] text-secondary" strokeWidth={3} aria-hidden />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </StaffMain>
    </>
  );
}
