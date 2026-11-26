"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { tutorApi } from "@/lib/api-staff";
import { useAsync } from "@/lib/hooks/useAsync";
import { plural } from "@/lib/utils";
import { PageHeader, StatusChip } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";

export function MyClassesScreen() {
  const { data, error, loading, reload } = useAsync(() => tutorApi.classes(), []);
  return (
    <>
      <StaffMain>
        <PageHeader title="My classes" subtitle="Who you teach and which exams each class has." />
        {loading && <Skeleton className="h-52 rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/tutor" backLabel="Back to my exams" />}
        {data && data.length === 0 && <EmptyState title="No classes yet" Icon={Users}>An admin sets up classes and assigns them to you.</EmptyState>}
        {data && data.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.map((c) => (
              <Card key={c.id} className="flex flex-col gap-4 p-[22px]">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-[21px] font-black">{c.name}</h2>
                  <span className="text-[13px] font-bold text-muted">
                    {c.subjectCode} · Grade {c.grade} · {plural(c.students.length, "student")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.students.map((s) => (
                    <span key={s.id} className="flex h-10 items-center gap-2 rounded-full bg-paper py-1 pl-1 pr-3.5 text-sm font-extrabold">
                      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-mint text-xs font-black text-mint-deep">{s.initials}</span>
                      {s.name}
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-2 border-t border-line-header pt-3.5">
                  <h3 className="text-sm font-black text-muted">Exams</h3>
                  {c.exams.length === 0 && <p className="text-sm font-bold text-muted">None yet.</p>}
                  {c.exams.map((e) => (
                    <Link key={e.sessionId} href={`/tutor/exams/${e.examId}/sessions`} className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-3.5 py-3 text-sm font-extrabold text-ink no-underline hover:bg-paper hover:text-ink">
                      <span className="min-w-0 truncate">{e.title}</span>
                      <StatusChip tone={e.released ? "mint" : e.status === "open" ? "mint" : "neutral"} dot={e.status === "open" ? "bg-mint-ink" : undefined}>
                        {e.released ? "Released" : e.status === "not_open" ? "Not open" : e.status === "open" ? "Open" : "Closed"}
                      </StatusChip>
                    </Link>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </StaffMain>
    </>
  );
}
