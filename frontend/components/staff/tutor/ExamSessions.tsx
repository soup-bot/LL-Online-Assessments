"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Check, Lock, Search } from "lucide-react";
import { toApiError } from "@/lib/api";
import { tutorApi } from "@/lib/api-staff";
import type { ClassCard, ExamSessions as ExamSessionsData, LiveData, LiveRow, LiveState } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, formatDate, formatTime, plural } from "@/lib/utils";
import { BackLink, ConfirmModal, FilterPill, MiniProgress, Pagination, Select, StatusChip, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, ButtonLink, Card, Chip, EmptyState, ErrorState, GradeTile, Notice, Skeleton } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

export function ExamSessionsScreen() {
  const params = useParams<{ examId: string }>();
  const examId = Number(params.examId);
  const { data, error, loading, reload, refresh } = useAsync(() => tutorApi.sessions(examId), [examId]);

  return (
    <>
      <StaffMain>
        <BackLink href="/tutor">My exams</BackLink>
        {loading && <Skeleton className="h-[34rem] rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={error.code === "network" ? reload : undefined} backHref="/tutor" backLabel="Back to my exams" />}
        {data && <SessionsContent data={data} onChange={refresh} />}
      </StaffMain>
    </>
  );
}

function SessionsContent({ data, onChange }: { data: ExamSessionsData; onChange: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  // Open batches first, so the one that needs watching is already selected.
  const active = data.classes.find((c) => c.sessionId === selected) ?? data.classes.find((c) => c.status === "open") ?? data.classes[0];
  const published = data.exam.status === "published";

  const totals = {
    open: data.classes.filter((c) => c.status === "open").length,
    sitting: data.classes.reduce((n, c) => n + c.sitting, 0),
    toMark: data.classes.reduce((n, c) => n + c.toMark, 0),
    handedIn: data.classes.reduce((n, c) => n + c.handedIn, 0),
    students: data.classes.reduce((n, c) => n + c.students, 0),
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-2">
          <StatusChip tone={published ? "lilac" : "neutral"}>{published ? "Published" : "Draft"}</StatusChip>
          {published && (
            <Chip tone="neutral" size="md">
              <Lock className="size-3" strokeWidth={3} aria-hidden /> Answer key locked
            </Chip>
          )}
        </div>
        <h1 className="text-[26px] font-black leading-tight md:text-3xl">{data.exam.title}</h1>
      </div>

      {!published && (
        <Notice
          variant="warn"
          title="Not published yet"
          action={
            <ButtonLink href={`/tutor/exams/${data.exam.id}`} variant="dark" size="sm">
              Back to the builder
            </ButtonLink>
          }
        >
          Publish the exam before you can open it for a class.
        </Notice>
      )}

      {data.classes.length === 0 ? (
        <EmptyState title="No classes linked">Choose classes for this exam in the builder.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Total label="Batches open" value={`${totals.open} of ${data.classes.length}`} tone="bg-mint text-mint-deep" />
            <Total label="Sitting now" value={totals.sitting} tone="bg-secondary-soft text-secondary-dark" />
            <Total label="To mark" value={totals.toMark} tone="bg-amber text-amber-ink" />
            <Total label="Handed in" value={`${totals.handedIn} of ${totals.students}`} tone="bg-chip text-ink" />
          </div>

          <div className="flex flex-col items-stretch gap-5 md:flex-row md:items-start">
            <BatchNav classes={data.classes} activeId={active?.sessionId} onSelect={setSelected} />
            {active && <BatchDetail key={active.sessionId} card={active} canEdit={data.canEdit && published} onChange={onChange} />}
          </div>
        </>
      )}
    </>
  );
}

function Total({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 rounded-[22px] px-4 py-3.5", tone)}>
      <span className="text-2xl font-black leading-tight">{value}</span>
      <span className="text-[13px] font-extrabold opacity-80">{label}</span>
    </div>
  );
}

/* ------------------------------------------------------------------- batches */

const SESSION_CHIP: Record<ClassCard["status"], { tone: ChipTone; label: string }> = {
  not_open: { tone: "neutral", label: "Not open" },
  open: { tone: "mint", label: "Open" },
  closed: { tone: "neutral", label: "Closed" },
};

function metaText(c: ClassCard) {
  if (c.releasedAt) return "Results released";
  if (c.status === "not_open") return "Not open";
  const parts: string[] = [];
  if (c.status === "open") parts.push(c.sitting ? `${c.sitting} sitting` : "Open");
  else parts.push(c.toMark ? "Closed" : "Closed · all marked");
  return parts.join(" · ");
}

/** Every batch, always visible. Desktop: a list down the left. Phones: a dropdown. */
function BatchNav({ classes, activeId, onSelect }: { classes: ClassCard[]; activeId?: number; onSelect: (id: number) => void }) {
  // An exam that spans subjects has several "Batch A"s, so then the subject is part of the name.
  const mixed = new Set(classes.map((c) => c.name.split(",")[0])).size > 1;
  const nameOf = (c: ClassCard) => (mixed ? c.name.replace(/^(IGCSE|IAL)\s+/i, "").replace(", ", " · ") : c.label);
  return (
    <>
      <div className="md:hidden">
        <label htmlFor="batch-select" className="mb-1.5 block text-sm font-extrabold">
          Batch
        </label>
        <Select id="batch-select" value={activeId} onChange={(e) => onSelect(Number(e.target.value))}>
          {classes.map((c) => (
            <option key={c.sessionId} value={c.sessionId}>
              {nameOf(c)} · {metaText(c)}
              {c.toMark ? ` · ${c.toMark} to mark` : ""}
            </option>
          ))}
        </Select>
      </div>

      <nav aria-label="Batches" className="hidden w-[270px] shrink-0 flex-col gap-1 md:flex md:max-h-[min(70dvh,640px)]">
        <h2 className="px-2 pb-1 text-xs font-black uppercase tracking-wider text-muted">Batches · {classes.length}</h2>
        <div className="thin-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-scroll overscroll-contain pb-1 pr-1.5">
          {classes.map((c) => {
            const on = c.sessionId === activeId;
            return (
              <button
                key={c.sessionId}
                type="button"
                onClick={() => onSelect(c.sessionId)}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition",
                  on ? "border-secondary bg-white" : "border-transparent bg-white/60 hover:border-line hover:bg-white",
                )}
              >
                <span
                  aria-hidden
                  className={cn("size-2.5 shrink-0 rounded-full", c.status === "open" ? "bg-mint-ink" : c.releasedAt ? "bg-secondary" : c.status === "closed" ? "bg-subtle" : "border-2 border-[#cfc9be]")}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate text-[15px] font-black", on && "text-secondary-dark")}>{nameOf(c)}</span>
                  <span className="truncate text-xs font-bold text-muted">{metaText(c)}</span>
                </span>
                {c.toMark > 0 && (
                  <span title={`${c.toMark} to mark`} className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-amber px-1.5 text-xs font-black text-amber-ink">
                    {c.toMark}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/** One batch: its status and controls, then who is sitting and who needs marking. */
function BatchDetail({ card, canEdit, onChange }: { card: ClassCard; canEdit: boolean; onChange: () => void }) {
  const toast = useToast();
  const [ask, setAsk] = useState<"open" | "close" | "release" | null>(null);
  const open = card.status === "open";
  const closed = card.status === "closed";
  const released = card.releasedAt != null;
  const chip = released ? { tone: "mint" as ChipTone, label: "Results released" } : SESSION_CHIP[card.status];
  const canRelease = closed && card.toMark === 0 && !released;
  const live = useAsync(() => tutorApi.live(card.sessionId), [card.sessionId]);

  // Keep the list fresh while the teacher watches an exam.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        live.refresh();
        onChange();
      }
    }, 10_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.refresh]);

  async function run(action: "open" | "close" | "release") {
    try {
      if (action === "open") {
        await tutorApi.openSession(card.sessionId);
        toast(`Open for ${card.label}. Students can start now.`);
      } else if (action === "close") {
        const { submitted } = await tutorApi.closeSession(card.sessionId);
        toast(submitted ? `Closed. ${plural(submitted, "student")} handed in automatically.` : `Closed for ${card.label}.`);
      } else {
        await tutorApi.releaseResults(card.sessionId);
        toast(`Results released to ${card.label}.`);
      }
    } catch (e) {
      toast(toApiError(e).message, "error");
    }
    setAsk(null);
    live.refresh();
    onChange();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <Card className="flex flex-col gap-4 p-[22px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] font-black">{card.name}</h2>
            <StatusChip tone={chip.tone} dot={open ? "bg-mint-ink" : undefined}>
              {open && card.openedAt ? `Open since ${formatTime(card.openedAt)}` : chip.label}
            </StatusChip>
          </div>
          {canEdit && card.status === "not_open" && <Button onClick={() => setAsk("open")}>Open for {card.label}</Button>}
          {canEdit && open && (
            <Button variant="secondary" onClick={() => setAsk("close")}>
              Close for {card.label}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Chip tone="neutral" size="lg">{plural(card.students, "student")}</Chip>
          {card.status !== "not_open" && (
            <>
              <Chip tone="neutral" size="lg">{card.handedIn} handed in</Chip>
              {card.sitting > 0 && <Chip tone="lilac" size="lg">{card.sitting} sitting now</Chip>}
              {card.toMark > 0 && <Chip tone="amber" size="lg">{card.toMark} to mark</Chip>}
              {closed && card.notStarted > 0 && <Chip tone="neutral" size="lg">{card.notStarted} not attempted</Chip>}
            </>
          )}
          {card.status === "not_open" && <span className="self-center text-sm font-bold text-muted">They can&apos;t see this exam yet.</span>}
        </div>

        {card.status !== "not_open" && (
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[20px] bg-canvas px-4 py-3.5">
            {released ? (
              <span className="text-sm font-extrabold text-mint-deep">
                Results released{card.releasedAt ? ` on ${formatDate(card.releasedAt)}` : ""}. Students can see their marks and feedback.
              </span>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <span className="text-sm font-black">Release results</span>
                  <Step done={closed}>Close the exam</Step>
                  <Step done={closed && card.toMark === 0} warn={card.toMark > 0}>
                    {card.toMark > 0 ? `Mark every submission (${card.toMark} left)` : "Mark every submission"}
                  </Step>
                </div>
                {canEdit && (
                  <Button size="md" disabled={!canRelease} onClick={() => setAsk("release")}>
                    Release to {card.label}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {live.loading && <Skeleton className="h-64 rounded-[28px]" />}
      {live.error && <ErrorState code={live.error.code} message={live.error.message} onRetry={live.reload} />}
      {live.data && <LiveList data={live.data} canEdit={canEdit} />}

      <ConfirmModal open={ask === "open"} onClose={() => setAsk(null)} title={`Open for ${card.label}?`} confirmLabel="Open now" onConfirm={() => run("open")}>
        <p>
          {plural(card.students, "student")} will see the exam straight away and can start it. Each student gets the full time limit from
          the moment they begin.
        </p>
      </ConfirmModal>
      <ConfirmModal open={ask === "close"} onClose={() => setAsk(null)} title={`Close for ${card.label}?`} confirmLabel="Close exam" tone="dark" onConfirm={() => run("close")}>
        <p>
          {card.sitting > 0 ? `${plural(card.sitting, "student")} still sitting will be handed in with what they have saved. ` : ""}
          Nobody else can start it after this. Students who never started will show as &quot;not attempted&quot;.
        </p>
      </ConfirmModal>
      <ConfirmModal open={ask === "release"} onClose={() => setAsk(null)} title={`Release results to ${card.label}?`} confirmLabel="Release results" onConfirm={() => run("release")}>
        <p>Students will see their marks, grade and your feedback straight away. This can&apos;t be taken back.</p>
      </ConfirmModal>
    </div>
  );
}

const STATE_CHIP: Record<LiveState, { tone: ChipTone; label: string } | null> = {
  not_started: { tone: "neutral", label: "Not started" },
  sitting: { tone: "lilac", label: "In progress" },
  to_mark: { tone: "amber", label: "Needs marking" },
  marked: { tone: "mint", label: "Marked" },
  not_attempted: { tone: "neutral", label: "Not attempted" },
};

type RowFilter = "all" | "to_mark" | "sitting" | "waiting" | "marked";

/** Order rows by what needs the teacher first: marking, then sitting, then the rest. */
const STATE_ORDER: Record<LiveState, number> = { to_mark: 0, sitting: 1, not_started: 2, marked: 3, not_attempted: 4 };
const ROW_PAGE = 25;

function inFilter(row: LiveRow, f: RowFilter) {
  if (f === "all") return true;
  if (f === "waiting") return row.state === "not_started" || row.state === "not_attempted";
  return row.state === f;
}

function LiveList({ data, canEdit }: { data: LiveData; canEdit: boolean }) {
  const { card } = data;
  const [filter, setFilter] = useState<RowFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(ROW_PAGE);

  const counts = {
    all: data.rows.length,
    to_mark: data.rows.filter((r) => inFilter(r, "to_mark")).length,
    sitting: data.rows.filter((r) => inFilter(r, "sitting")).length,
    waiting: data.rows.filter((r) => inFilter(r, "waiting")).length,
    marked: data.rows.filter((r) => inFilter(r, "marked")).length,
  };
  const pills: { id: RowFilter; label: string }[] = [
    { id: "all", label: "Everyone" },
    ...(counts.to_mark ? [{ id: "to_mark" as const, label: "Needs marking" }] : []),
    ...(counts.sitting ? [{ id: "sitting" as const, label: "Sitting now" }] : []),
    ...(counts.waiting ? [{ id: "waiting" as const, label: card.status === "closed" ? "Not attempted" : "Not started" }] : []),
    ...(counts.marked ? [{ id: "marked" as const, label: "Marked" }] : []),
  ];

  const q = query.trim().toLowerCase();
  const matched = data.rows
    .filter((r) => inFilter(r, filter) && (!q || r.name.toLowerCase().includes(q)))
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  const current = Math.min(page, pages - 1);
  const shown = matched.slice(current * pageSize, (current + 1) * pageSize);

  return (
    <Card className="flex min-w-0 flex-col gap-3 p-[22px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <h2 className="text-[19px] font-black">
          {card.label}
          {card.status === "open" && " · live"}
        </h2>
        {card.status === "open" && <span className="text-[13px] font-bold text-muted">Refreshes every 10 seconds</span>}
      </div>

      {(
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="student-search">Search students</label>
          <div className="relative min-w-0 flex-1 basis-48 md:max-w-[260px]">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
            <input
              id="student-search"
              type="search"
              value={query}
              placeholder="Search students"
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              className={cn(inputClass, "h-10 rounded-full pl-10 pr-4 text-sm")}
            />
          </div>
          {pills.map((p) => (
              <FilterPill
                key={p.id}
                active={filter === p.id}
                onClick={() => {
                  setFilter(p.id);
                  setPage(0);
                }}
              >
                {p.label} · {counts[p.id]}
              </FilterPill>
            ))}
        </div>
      )}

      {data.rows.length === 0 ? (
        <p className="rounded-2xl bg-paper px-4 py-6 text-center text-sm font-bold text-muted">There are no students in this class yet.</p>
      ) : matched.length === 0 ? (
        <p className="rounded-2xl bg-paper px-4 py-6 text-center text-sm font-bold text-muted">No students match.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {shown.map((row) => (
            <Row key={row.studentId} row={row} canEdit={canEdit} />
          ))}
        </ul>
      )}
      {data.rows.length > 0 && (
        <Pagination
          className="pt-1"
          total={matched.length}
          page={current}
          pageSize={pageSize}
          sizes={[10, 25, 50, 100]}
          onPage={setPage}
          onPageSize={(n) => {
            setPageSize(n);
            setPage(0);
          }}
        />
      )}
    </Card>
  );
}

const Row = memo(RowBase, (a, b) => a.canEdit === b.canEdit && JSON.stringify(a.row) === JSON.stringify(b.row));

/** A row only re-renders when its own data changed, so a 10-second refresh doesn't redraw 100 students. */
function RowBase({ row, canEdit }: { row: LiveRow; canEdit: boolean }) {
  const chip = STATE_CHIP[row.state]!;
  const started = row.state !== "not_started" && row.state !== "not_attempted";
  const action =
    row.attemptId && (row.state === "to_mark" || row.state === "marked")
      ? { href: `/tutor/attempts/${row.attemptId}`, label: row.state === "to_mark" && canEdit ? "Mark" : "View", primary: row.state === "to_mark" && canEdit }
      : null;

  return (
    <li className="flex flex-wrap items-center gap-x-[18px] gap-y-3 rounded-[22px] border border-[#f0ece5] bg-canvas p-3.5">
      <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-mint text-sm font-black text-mint-deep">
        {row.initials}
      </span>
      <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
        <span className="text-base font-black">{row.name}</span>
        <span className="text-[13px] font-bold text-muted">{row.detail}</span>
      </div>
      {started && (
        <div className="w-[150px]">
          <MiniProgress label={`${row.answered} of ${row.questionCount} answered`} value={row.questionCount ? (row.answered / row.questionCount) * 100 : 0} />
        </div>
      )}
      {started && (
        <Chip tone={row.violations > 0 ? "peach" : "neutral"} size="md">
          Left window: {row.violations}
        </Chip>
      )}
      <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
      <span className="flex min-w-[90px] items-center justify-end gap-2 text-right text-[15px] font-black">
        {row.grade && <GradeTile grade={row.grade} size="sm" className="size-8 rounded-[10px] text-base" />}
        {row.scoreText}
      </span>
      {action && (
        <Link
          href={action.href}
          className={cn(
            "flex h-[42px] items-center rounded-full px-4 text-sm font-black no-underline transition active:scale-95",
            action.primary ? "bg-squiggly bg-brand text-white hover:bg-brand-dark hover:text-white" : "border-2 border-line-input bg-white text-ink hover:bg-paper hover:text-ink",
          )}
        >
          {action.label}
        </Link>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------- release */

function Step({ done, warn, children }: { done: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-sm font-extrabold">
      <span
        aria-hidden
        className={cn(
          "grid size-[26px] shrink-0 place-items-center rounded-full border-2",
          done ? "border-mint-ink bg-mint-ink text-white" : warn ? "border-amber-line bg-amber" : "border-[#d8d2c8]",
        )}
      >
        {done && <Check className="size-3.5" strokeWidth={4} />}
      </span>
      {children}
    </div>
  );
}

