"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { adminApi } from "@/lib/api-staff";
import type { AdminExamStatus } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { cn } from "@/lib/utils";
import { PageHeader, MiniProgress, Pagination, Select, StatusChip, inputClass } from "@/components/staff/bits";
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
  const [teacher, setTeacher] = useState("");
  const [cls, setCls] = useState("");
  const [status, setStatus] = useState<"" | AdminExamStatus>("");
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 300);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Every filter is applied by the server, so only one page of rows is ever sent.
  const { data, error, loading, reload } = useAsync(
    () => adminApi.exams({ teacher: teacher ? Number(teacher) : undefined, class: cls ? Number(cls) : undefined, status: status || undefined, q, page: page + 1, perPage: pageSize }),
    [teacher, cls, status, q, page, pageSize],
  );
  const reset = () => setPage(0);

  return (
    <StaffMain>
      <PageHeader title="All exams" subtitle="Every published exam across every class. One row per exam and class." />

      <div className="flex flex-wrap items-center gap-2.5">
        <label className="sr-only" htmlFor="exam-search">Search exams</label>
        <div className="relative min-w-0 max-w-[320px] flex-1 basis-56">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
          <input
            id="exam-search"
            type="search"
            value={text}
            placeholder="Search exams"
            onChange={(e) => {
              setText(e.target.value);
              reset();
            }}
            className={cn(inputClass, "h-11 rounded-full pl-10 pr-4 text-sm")}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-extrabold">
          Teacher
          <Select className="h-11 w-auto! rounded-full text-sm" value={teacher} onChange={(e) => { setTeacher(e.target.value); reset(); }}>
            <option value="">Everyone</option>
            {(data?.teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm font-extrabold">
          Class
          <Select className="h-11 w-auto! rounded-full text-sm" value={cls} onChange={(e) => { setCls(e.target.value); reset(); }}>
            <option value="">All</option>
            {(data?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm font-extrabold">
          Status
          <Select className="h-11 w-auto! rounded-full text-sm" value={status} onChange={(e) => { setStatus(e.target.value as "" | AdminExamStatus); reset(); }}>
            <option value="">Any</option>
            {(Object.keys(STATUS) as AdminExamStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </Select>
        </label>
      </div>

      {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
      {!error && !data && <Skeleton className="h-72 rounded-[28px]" />}
      {!error && data && data.meta.total === 0 && <EmptyState title="No exams match">Published exams show up here.</EmptyState>}
      {!error && data && data.meta.total > 0 && (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          {data.rows.map((r) => (
            <Card key={r.sessionId} className="flex flex-wrap items-center gap-x-[22px] gap-y-3.5 rounded-[26px] px-[22px] py-[18px]">
              <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-1">
                <span className="text-[17px] font-black">{r.title}</span>
                <span className="text-[13px] font-bold text-muted">{r.teacher} · {r.className}</span>
              </div>
              <span className="w-[140px]"><StatusChip tone={STATUS[r.status].tone} dot={r.status === "open" ? "bg-mint-ink" : undefined}>{STATUS[r.status].label}</StatusChip></span>
              <div className="w-[180px]">
                <MiniProgress label={`${r.handedIn} of ${r.students} submitted · ${r.marked} marked`} value={r.students ? (r.handedIn / r.students) * 100 : 0} />
              </div>
              <span className="min-w-[110px] text-right text-[15px] font-black">{r.averagePercent != null ? `Average ${Math.round(r.averagePercent)}%` : "—"}</span>
              <ButtonLink href={`/tutor/exams/${r.examId}/sessions`} variant="secondary" size="sm">View</ButtonLink>
            </Card>
          ))}
          <Pagination
            total={data.meta.total}
            page={page}
            pageSize={pageSize}
            sizes={[10, 25, 50, 100]}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(0);
            }}
          />
        </div>
      )}
    </StaffMain>
  );
}
