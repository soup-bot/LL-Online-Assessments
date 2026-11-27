"use client";

import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { adminApi } from "@/lib/api-staff";
import type { AdminExamRow, AdminExamStatus } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { useClampPage, useQueryState, useSearchText } from "@/lib/hooks/useQueryState";
import { cn } from "@/lib/utils";
import { PageHeader, MiniProgress, Pagination, Select, StatusChip, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { ButtonLink, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

const STATUS: Record<AdminExamStatus, { tone: ChipTone; label: string }> = {
  not_open: { tone: "neutral", label: "Not open" },
  open: { tone: "mint", label: "Open now" },
  closed: { tone: "neutral", label: "Closed" },
  released: { tone: "sky", label: "Results released" },
};

export function AdminExamsScreen() {
  const [p, update] = useQueryState({ teacher: 0, class: 0, status: "", q: "", page: 1, size: 25 });
  const [text, setText] = useSearchText(p.q, (q) => update({ q }, "replace"));

  // Every filter is applied by the server, so only one page of rows is ever sent.
  const { data, error, loading, reload } = useAsync(
    () => adminApi.exams({ teacher: p.teacher || undefined, class: p.class || undefined, status: (p.status || undefined) as AdminExamStatus | undefined, q: p.q, page: p.page, perPage: p.size }),
    [p.teacher, p.class, p.status, p.q, p.page, p.size],
  );
  useClampPage(data?.meta.total, p.page, p.size, () => update({ page: 1 }, "replace"));

  return (
    <StaffMain>
      <PageHeader title="All exams" subtitle="Every published exam across every class. One row per exam and class." />

      <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
        <label className="sr-only" htmlFor="exam-search">Search exams</label>
        <div className="relative col-span-2 sm:w-64">
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
          <input
            id="exam-search"
            type="search"
            value={text}
            placeholder="Search exams"
            onChange={(e) => setText(e.target.value)}
            className={cn(inputClass, "h-11 rounded-full pl-10 pr-4 text-sm")}
          />
        </div>
        <label className="sr-only" htmlFor="exam-teacher">Teacher</label>
        <Select id="exam-teacher" className="h-11 w-full truncate rounded-full text-sm sm:w-44" value={p.teacher || ""} onChange={(e) => update({ teacher: Number(e.target.value) })}>
          <option value="">All teachers</option>
          {(data?.teachers ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
        <label className="sr-only" htmlFor="exam-class">Class</label>
        <Select id="exam-class" className="h-11 w-full truncate rounded-full text-sm sm:w-44" value={p.class || ""} onChange={(e) => update({ class: Number(e.target.value) })}>
          <option value="">All classes</option>
          {(data?.classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <label className="sr-only" htmlFor="exam-status">Status</label>
        <Select id="exam-status" className="col-span-2 h-11 w-full rounded-full text-sm sm:col-span-1 sm:w-40" value={p.status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Any status</option>
          {(Object.keys(STATUS) as AdminExamStatus[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </Select>
      </div>

      {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
      {!error && !data && <Skeleton className="h-72 rounded-[28px]" />}
      {!error && data && data.meta.total === 0 && <EmptyState title="No exams match">Published exams show up here.</EmptyState>}
      {!error && data && data.meta.total > 0 && (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <div className="flex flex-col gap-3 md:hidden">
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
          </div>
          <ExamTable rows={data.rows} />
          <Pagination
            total={data.meta.total}
            page={p.page - 1}
            pageSize={p.size}
            sizes={[10, 25, 50, 100]}
            onPage={(n) => update({ page: n + 1 })}
            onPageSize={(n) => update({ size: n })}
          />
        </div>
      )}
    </StaffMain>
  );
}

/** Desktop view: one row per exam and class. Phones get the cards above instead. */
function ExamTable({ rows }: { rows: AdminExamRow[] }) {
  return (
    <Card className="hidden rounded-[26px] md:block">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-canvas/60">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Exam</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Teacher</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Class</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Status</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Progress</th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted" >Average</th>
            <th scope="col" className="w-px px-5 py-3"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sessionId} className="border-t border-line transition-colors first:border-t-0 hover:bg-canvas/70">
              <td className="py-3.5 pl-5 pr-4 text-[15px] font-black">
                <Link href={`/tutor/exams/${r.examId}/sessions`} className="text-ink no-underline hover:text-secondary-dark">{r.title}</Link>
              </td>
              <td className="px-4 py-3.5 text-sm font-bold text-ink-2">{r.teacher}</td>
              <td className="px-4 py-3.5 text-sm font-bold text-ink-2">{r.className}</td>
              <td className="px-4 py-3.5">
                <StatusChip tone={STATUS[r.status].tone} dot={r.status === "open" ? "bg-mint-ink" : undefined}>{STATUS[r.status].label}</StatusChip>
              </td>
              <td className="w-[210px] px-4 py-3.5">
                <MiniProgress compact label={`${r.handedIn} of ${r.students} submitted · ${r.marked} marked`} value={r.students ? (r.handedIn / r.students) * 100 : 0} />
              </td>
              <td className="px-4 py-3.5 text-sm font-black">{r.averagePercent != null ? `${Math.round(r.averagePercent)}%` : <span className="text-subtle">—</span>}</td>
              <td className="py-3.5 pl-4 pr-5">
                <Link
                  href={`/tutor/exams/${r.examId}/sessions`}
                  aria-label={`View ${r.title}, ${r.className}`}
                  title="View"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-secondary-dark no-underline transition hover:bg-secondary-soft hover:text-secondary-dark"
                >
                  <Eye className="size-[18px]" strokeWidth={2.3} aria-hidden />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
