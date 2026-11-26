"use client";

import { useState } from "react";
import { adminApi } from "@/lib/api-staff";
import type { AdminExamStatus } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { PageHeader, MiniProgress, Select, StatusChip } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { ButtonLink, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

const STATUS: Record<AdminExamStatus, { tone: ChipTone; label: string }> = {
  not_open: { tone: "neutral", label: "Not open" },
  open: { tone: "mint", label: "Open" },
  closed: { tone: "neutral", label: "Closed" },
  released: { tone: "brand", label: "Results released" },
};

export function AdminExamsScreen() {
  const { data, error, loading, reload } = useAsync(() => adminApi.exams(), []);
  const [teacher, setTeacher] = useState("");
  const [cls, setCls] = useState("");

  const rows = (data?.rows ?? []).filter((r) => (!teacher || r.teacherId === Number(teacher)) && (!cls || r.classId === Number(cls)));

  return (
    <>
      <StaffMain>
        <PageHeader
          title="All exams"
          subtitle="Every published exam across every class. One row per exam and class."
          actions={
            data && (
              <>
                <label className="flex items-center gap-2 text-sm font-extrabold">
                  Teacher
                  <Select className="h-11 w-auto! rounded-full text-sm" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
                    <option value="">Everyone</option>
                    {data.teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </label>
                <label className="flex items-center gap-2 text-sm font-extrabold">
                  Class
                  <Select className="h-11 w-auto! rounded-full text-sm" value={cls} onChange={(e) => setCls(e.target.value)}>
                    <option value="">All</option>
                    {data.classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </Select>
                </label>
              </>
            )
          }
        />
        {loading && <Skeleton className="h-72 rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
        {data && rows.length === 0 && <EmptyState title="No exams match">Published exams show up here.</EmptyState>}
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <Card key={r.sessionId} className="flex flex-wrap items-center gap-x-[22px] gap-y-3.5 rounded-[26px] px-[22px] py-[18px]">
              <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-1">
                <span className="text-[17px] font-black">{r.title}</span>
                <span className="text-[13px] font-bold text-muted">{r.teacher} · {r.className}</span>
              </div>
              <span className="w-[140px]"><StatusChip tone={STATUS[r.status].tone} dot={r.status === "open" ? "bg-mint-ink" : undefined}>{STATUS[r.status].label}</StatusChip></span>
              <div className="w-[180px]">
                <MiniProgress label={`${r.handedIn} of ${r.students} submitted · ${r.marked} marked`} value={r.students ? (r.handedIn / r.students) * 100 : 0} />
              </div>
              <span className="min-w-[110px] text-right text-[15px] font-black">{r.averageText}</span>
              <ButtonLink href={`/tutor/exams/${r.examId}/sessions`} variant="secondary" size="sm">View</ButtonLink>
            </Card>
          ))}
        </div>
      </StaffMain>
    </>
  );
}
