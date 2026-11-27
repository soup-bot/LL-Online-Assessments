"use client";

import Link from "next/link";
import { ArrowRight, PartyPopper, Search } from "lucide-react";
import { tutorApi } from "@/lib/api-staff";
import type { ToMarkSort } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { useClampPage, useQueryState, useSearchText } from "@/lib/hooks/useQueryState";
import { cn, formatTime, plural } from "@/lib/utils";
import { PageHeader, Pagination, Select, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { Button, Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";

const SORTS: { value: ToMarkSort; label: string }[] = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
  { value: "student", label: "Student A–Z" },
];

export function ToMarkScreen() {
  const [p, update] = useQueryState({ q: "", exam: 0, class: 0, sort: "oldest", page: 1, size: 10 });
  const [text, setText] = useSearchText(p.q, (q) => update({ q }, "replace"));

  // Search, filters, sort and page are all applied by the server, so only one page of rows is ever sent.
  const { data, error, loading, reload } = useAsync(
    () => tutorApi.toMark({ q: p.q, exam: p.exam || undefined, class: p.class || undefined, sort: p.sort as ToMarkSort, page: p.page, perPage: p.size }),
    [p.q, p.exam, p.class, p.sort, p.page, p.size],
  );
  useClampPage(data?.meta.total, p.page, p.size, () => update({ page: 1 }, "replace"));

  const filtered = Boolean(p.q || p.exam || p.class);
  const nothingWaiting = data != null && data.filters.total === 0;
  // The choices come from everything waiting, so a stale link to an exam with nothing left still shows as chosen.
  const examOptions = data?.filters.exams ?? [];
  const classOptions = data?.filters.classes ?? [];

  return (
    <StaffMain>
      <PageHeader title="To mark" subtitle="Submissions with written answers waiting for you." />

      {/* Nothing is drawn until the server has answered, so the filters never appear and then vanish. */}
      {data != null && !nothingWaiting && (
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor="mark-search">Search submissions</label>
          <div className="relative col-span-2 sm:w-64">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
            <input
              id="mark-search"
              type="search"
              value={text}
              placeholder="Search student or exam"
              onChange={(e) => setText(e.target.value)}
              className={cn(inputClass, "h-11 rounded-full pl-10 pr-4 text-sm")}
            />
          </div>
          <label className="sr-only" htmlFor="mark-exam">Exam</label>
          <Select id="mark-exam" className="h-11 w-full truncate rounded-full text-sm sm:w-52" value={p.exam || ""} onChange={(e) => update({ exam: Number(e.target.value) })}>
            <option value="">All exams</option>
            {examOptions.map((e) => <option key={e.id} value={e.id}>{e.title} ({e.count})</option>)}
          </Select>
          <label className="sr-only" htmlFor="mark-class">Class</label>
          <Select id="mark-class" className="h-11 w-full truncate rounded-full text-sm sm:w-44" value={p.class || ""} onChange={(e) => update({ class: Number(e.target.value) })}>
            <option value="">All classes</option>
            {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
          </Select>
          <label className="sr-only" htmlFor="mark-sort">Sort</label>
          <Select id="mark-sort" className="col-span-2 h-11 w-full rounded-full text-sm sm:col-span-1 sm:ml-auto sm:w-40" value={p.sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
        </div>
      )}

      {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/tutor" backLabel="Back to my exams" />}
      {!error && !data && (
        <>
          <Skeleton className="h-11 max-w-[640px] rounded-full" />
          <Skeleton className="h-52 rounded-[28px]" />
        </>
      )}
      {!error && nothingWaiting && (
        <EmptyState title="All caught up" Icon={PartyPopper}>
          Nothing is waiting to be marked.
        </EmptyState>
      )}
      {!error && data && !nothingWaiting && data.meta.total === 0 && (
        <EmptyState title="Nothing matches" Icon={Search}>
          {filtered ? "No submissions fit that search and those filters." : "Nothing is waiting to be marked."}
          {filtered && (
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={() => { setText(""); update({ q: "", exam: 0, class: 0 }); }}>
                Clear search and filters
              </Button>
            </div>
          )}
        </EmptyState>
      )}
      {!error && data && data.meta.total > 0 && (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <ul className="flex flex-col gap-3">
            {data.items.map((item) => (
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
          <Pagination
            total={data.meta.total}
            page={p.page - 1}
            pageSize={p.size}
            onPage={(n) => update({ page: n + 1 })}
            onPageSize={(n) => update({ size: n })}
          />
        </div>
      )}
    </StaffMain>
  );
}
