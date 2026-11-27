"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronUp, ChevronsUpDown, ChartColumn, Hourglass, Pencil, Plus, Radio, Search, Send, Settings2, Sparkles, Trash2, Trophy, type LucideIcon } from "lucide-react";
import { toApiError } from "@/lib/api";
import { tutorApi } from "@/lib/api-staff";
import type { ExamFilter, ExamSort, ExamStage, TutorExamRow } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { forgetBuilder } from "@/lib/staff-snapshots";
import { useClampPage, useQueryState, useSearchText } from "@/lib/hooks/useQueryState";
import { cn, plural } from "@/lib/utils";
import { ConfirmModal, FilterPill, FilterTabs, MiniProgress, PageHeader, Pagination, Select, StatusChip, TiltTile, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Skeleton, TileWatermark } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

type SortState = { key: ExamSort; dir: "asc" | "desc" };

const FILTERS: { id: ExamFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "drafts", label: "Drafts" },
  { id: "published", label: "Published" },
  { id: "marking", label: "Needs marking" },
];

const STAGE: Record<ExamStage, { Icon: LucideIcon; tile: string; chip: { tone: ChipTone; label: string; dot?: string } }> = {
  draft: { Icon: Pencil, tile: "bg-chip text-ink-2", chip: { tone: "neutral", label: "Draft" } },
  ready: { Icon: Send, tile: "bg-secondary-soft text-secondary", chip: { tone: "lilac", label: "Published" } },
  live: { Icon: Radio, tile: "bg-mint text-mint-ink", chip: { tone: "mint", label: "Open now", dot: "bg-mint-ink" } },
  marking: { Icon: Hourglass, tile: "bg-amber text-amber-ink", chip: { tone: "amber", label: "Needs marking" } },
  released: { Icon: Trophy, tile: "bg-sky text-sky-deep", chip: { tone: "sky", label: "Results released" } },
};

/**
 * The teacher's exams. The server searches, filters, sorts and pages them, so a teacher with
 * hundreds of exams still receives one page at a time.
 */
export function ExamsListScreen() {
  const router = useRouter();
  const toast = useToast();

  // Everything the list shows lives in the address (?filter=drafts&q=unit&sort=name&page=2), so a refresh keeps
  // your place and a link opens the same view. No filter in the address means the server chooses: the exams
  // waiting to be marked if there are any, else all.
  const [p, update] = useQueryState({ filter: "", q: "", sort: "attention", dir: "asc", page: 1, size: 10 });
  const [text, setText] = useSearchText(p.q, (q) => update({ q }, "replace"));
  const sort: SortState = { key: p.sort as ExamSort, dir: p.dir === "desc" ? "desc" : "asc" };
  const [starting, setStarting] = useState<"new" | "import" | null>(null);

  const { data, error, loading, reload, refresh } = useAsync(
    () => tutorApi.home({ filter: (p.filter || undefined) as ExamFilter | undefined, q: p.q, sort: sort.key, dir: sort.dir, page: p.page, perPage: p.size }),
    [p.filter, p.q, p.sort, p.dir, p.page, p.size],
  );
  useClampPage(data?.meta.total, p.page, p.size, () => update({ page: 1 }, "replace"));
  // The pill shown as pressed is what the server actually applied, so there is one request and no switch afterwards.
  const filter = (p.filter as ExamFilter) || data?.filter || null;
  const q = p.q;

  const pick = (f: ExamFilter) => update({ filter: f });

  async function start(mode: "new" | "import") {
    setStarting(mode);
    try {
      const { examId } = await tutorApi.createExam();
      router.push(mode === "import" ? `/tutor/exams/${examId}/import` : `/tutor/exams/${examId}`);
    } catch (e) {
      toast(toApiError(e).message, "error");
      setStarting(null);
    }
  }

  const stats = data?.stats;
  const exams = data?.exams ?? [];
  const total = data?.meta.total ?? 0;

  return (
    <StaffMain>
      <PageHeader
        title="My exams"
        subtitle="Build an exam, then open it for a class."
        actions={
          <>
            <Button variant="secondary" onClick={() => void start("import")} loading={starting === "import"} disabled={starting != null}>
              <Sparkles className="size-5" aria-hidden /> Import with AI
            </Button>
            <Button onClick={() => void start("new")} loading={starting === "new"} disabled={starting != null}>
              <Plus className="size-5" strokeWidth={3} aria-hidden /> New exam
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        {stats ? (
          <>
            <StatTile src="/clock-green.png" tone="bg-mint" value={stats.open} label="Open right now" valueClass="text-mint-deep" labelClass="text-mint-deep" />
            <StatTile src="/pencil-amber.png" tone="bg-amber" value={stats.toMark} label={stats.toMark === 1 ? "Submission to mark" : "Submissions to mark"} valueClass="text-amber-ink" labelClass="text-[#7a4d00]" />
            <StatTile src="/question-blue.png" tone="bg-sky" value={stats.drafts} label={stats.drafts === 1 ? "Draft in progress" : "Drafts in progress"} valueClass="text-sky-deep" labelClass="text-sky-deep" />
          </>
        ) : (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-3xl" />)
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <FilterTabs label="Filter exams">
          {FILTERS.map((f) => (
            <FilterPill key={f.id} active={filter === f.id} onClick={() => pick(f.id)}>
              {f.label}
            </FilterPill>
          ))}
        </FilterTabs>
        <div className="ml-auto flex w-full flex-wrap items-center gap-2.5 md:w-auto md:flex-nowrap">
          <label className="sr-only" htmlFor="exam-search">Search exams</label>
          <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
            <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
            <input
              id="exam-search"
              type="search"
              value={text}
              placeholder="Search exams"
              onChange={(e) => setText(e.target.value)}
              className={cn(inputClass, "h-10 rounded-full pl-10 pr-4 text-sm")}
            />
          </div>
          <label className="sr-only" htmlFor="exam-sort">Sort exams</label>
          <Select id="exam-sort" value={sort.key} onChange={(e) => update({ sort: e.target.value, dir: "asc" })} className="h-10 w-auto! rounded-full text-sm md:hidden">
            <option value="attention">Needs attention first</option>
            <option value="recent">Newest first</option>
            <option value="name">Name A to Z</option>
          </Select>
        </div>
      </div>

      {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
      {!error && !data && <ListSkeleton />}
      {!error && data && total === 0 && (
        <EmptyState title={q || filter !== "all" ? "Nothing here" : "No exams yet"} Icon={Pencil}>
          {q || filter !== "all" ? `No exams match${q ? ` "${q}"` : " that filter"}.` : "Start a new exam, or let an AI tool turn your Word file into one."}
        </EmptyState>
      )}
      {!error && data && total > 0 && (
        <div className={cn("flex flex-col gap-3 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <ExamTable exams={exams} sort={sort} onSort={(s) => update({ sort: s.key, dir: s.dir })} onDeleted={refresh} />
          <div className="flex flex-col gap-3 md:hidden">
            {exams.map((exam) => (
              <ExamCard key={exam.id} exam={exam} onDeleted={refresh} />
            ))}
          </div>
          <Pagination
            total={total}
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

function StatTile({ src, tone, value, label, valueClass, labelClass }: { src: string; tone: string; value: number; label: string; valueClass: string; labelClass: string }) {
  return (
    <div className={cn("bg-fabric relative flex flex-col gap-0.5 overflow-hidden rounded-3xl px-5 py-[18px]", tone)}>
      <TileWatermark src={src} />
      <span className={cn("relative text-3xl font-black", valueClass)}>{value}</span>
      <span className={cn("relative text-sm font-extrabold", labelClass)}>{label}</span>
    </div>
  );
}

/** Class chips shown on a card before the rest collapse into "+N more". */
const MAX_CHIPS = 3;

function classText(c: TutorExamRow["classes"][number]) {
  if (c.released) return `${c.label} · results released`;
  return `${c.label} · ${c.status === "not_open" ? "not open" : c.status}`;
}

/** What the progress column says about an exam, depending on how far along it is. */
function progressOf(exam: TutorExamRow): { label: string; value: number; tone: string } {
  if (exam.stage === "draft") {
    return { label: `${exam.approvedCount} of ${exam.questionCount} approved`, value: exam.questionCount ? (exam.approvedCount / exam.questionCount) * 100 : 0, tone: "bg-secondary" };
  }
  if (exam.stage === "released") {
    return { label: `All marked${exam.averagePercent != null ? ` · average ${Math.round(exam.averagePercent)}%` : ""}`, value: 100, tone: "bg-mint-ink" };
  }
  return {
    label: `${exam.submitted} of ${exam.studentTotal} submitted${exam.toMark ? ` · ${exam.toMark} to mark` : ""}`,
    value: exam.studentTotal ? (exam.submitted / exam.studentTotal) * 100 : 0,
    // amber while something is waiting for the teacher, so it stands out down the column
    tone: exam.toMark > 0 ? "bg-amber-line" : "bg-secondary",
  };
}

/**
 * The table's progress column. A bar only where it says something: a draft with nothing approved and an exam
 * that is fully marked get a short line instead of an empty or a full bar.
 */
function ProgressCell({ exam }: { exam: TutorExamRow }) {
  if (exam.stage === "draft" && exam.approvedCount === 0) {
    return (
      <span className="text-xs font-bold text-muted">
        {exam.questionCount === 0 ? "No questions yet" : `${plural(exam.questionCount, "question")}, none approved`}
      </span>
    );
  }
  if (exam.stage === "released") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-mint-deep">
        <Check className="size-3.5" strokeWidth={3.5} aria-hidden />
        All marked{exam.averagePercent != null ? ` · average ${Math.round(exam.averagePercent)}%` : ""}
      </span>
    );
  }
  const progress = progressOf(exam);
  return <MiniProgress compact label={progress.label} value={progress.value} tone={progress.tone} />;
}

/** The one button on the row of an exam. */
function action(exam: TutorExamRow) {
  if (exam.stage === "draft") return { href: `/tutor/exams/${exam.id}`, label: "Continue editing", variant: "soft" as const, Icon: Pencil };
  if (exam.stage === "released") return { href: `/tutor/exams/${exam.id}/sessions`, label: "View results", variant: "secondary" as const, Icon: ChartColumn };
  return { href: `/tutor/exams/${exam.id}/sessions`, label: "Manage", variant: "dark" as const, Icon: Settings2 };
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: ExamSort; sort: SortState; onSort: (s: SortState) => void; className?: string }) {
  const on = sort.key === k;
  const Arrow = !on ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cn("px-4 py-3 text-left", className)}>
      <button
        type="button"
        onClick={() => onSort({ key: k, dir: on && sort.dir === "asc" ? "desc" : "asc" })}
        className={cn("-mx-2 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-black uppercase tracking-wider transition hover:bg-chip", on ? "text-secondary-dark" : "text-muted")}
      >
        {label}
        <Arrow aria-hidden className={cn("size-3.5", !on && "opacity-50")} strokeWidth={3} />
      </button>
    </th>
  );
}

/** Desktop view: one row per exam, with sortable columns. Phones get the cards below instead. */
function ExamTable({ exams, sort, onSort, onDeleted }: { exams: TutorExamRow[]; sort: SortState; onSort: (s: SortState) => void; onDeleted: () => void }) {
  return (
    <Card className="hidden rounded-[26px] md:block">
      <table className="w-full border-collapse">
        <thead className="border-b border-line bg-canvas/60">
          <tr>
            <SortHeader label="Exam" k="name" sort={sort} onSort={onSort} className="pl-5" />
            <SortHeader label="Status" k="attention" sort={sort} onSort={onSort} />
            <th scope="col" className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-muted">Classes</th>
            <SortHeader label="Progress" k="progress" sort={sort} onSort={onSort} />
            <th scope="col" className="w-px px-5 py-3"><span className="sr-only">Action</span></th>
          </tr>
        </thead>
        <tbody>
          {exams.map((exam) => (
            <ExamTableRow key={exam.id} exam={exam} onDeleted={onDeleted} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ExamTableRow({ exam, onDeleted }: { exam: TutorExamRow; onDeleted: () => void }) {
  const stage = STAGE[exam.stage];
  const act = action(exam);
  const open = exam.classes.filter((c) => c.status === "open").length;
  const href = exam.stage === "draft" ? `/tutor/exams/${exam.id}` : `/tutor/exams/${exam.id}/sessions`;

  return (
    <tr className="border-t border-line transition-colors first:border-t-0 hover:bg-canvas/70">
      <td className="py-3.5 pl-5 pr-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link href={href} className="text-[15px] font-black text-ink no-underline hover:text-secondary-dark">
            {exam.title}
          </Link>
          <span className="text-[13px] font-bold text-muted">
            {exam.timeLimitMinutes} min · {plural(exam.questionCount, "question")} · {plural(exam.totalMarks, "mark")}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5">
        <StatusChip tone={stage.chip.tone} dot={stage.chip.dot}>{stage.chip.label}</StatusChip>
      </td>
      <td className="px-4 py-3.5 text-sm font-bold text-ink-2">
        {exam.classes.length === 0 ? (
          <span className="text-subtle">None</span>
        ) : (
          <span title={exam.classes.map(classText).join(", ")}>
            {exam.classes.slice(0, 2).map((c) => c.label).join(", ")}
            {exam.classes.length > 2 && ` +${exam.classes.length - 2}`}
            {open > 0 && <span className="ml-1.5 text-mint-ink">· {open} open</span>}
          </span>
        )}
      </td>
      <td className="w-[210px] px-4 py-3.5">
        <ProgressCell exam={exam} />
      </td>
      <td className="py-3.5 pl-4 pr-5">
        <div className="flex items-center justify-end gap-1">
        {exam.stage === "draft" && <DeleteDraft exam={exam} onDeleted={onDeleted} />}
        <Link
          href={act.href}
          aria-label={`${act.label}: ${exam.title}`}
          title={act.label}
          className="grid size-9 shrink-0 place-items-center rounded-full text-secondary-dark no-underline transition hover:bg-secondary-soft hover:text-secondary-dark"
        >
          <act.Icon className="size-[18px]" strokeWidth={2.3} aria-hidden />
        </Link>
        </div>
      </td>
    </tr>
  );
}

/** A small bin button on a draft, with a confirmation. Only drafts can be deleted; published exams have been sat. */
function DeleteDraft({ exam, onDeleted }: { exam: TutorExamRow; onDeleted: () => void }) {
  const toast = useToast();
  const [asking, setAsking] = useState(false);
  const name = exam.title.trim() || "Untitled exam";

  async function remove() {
    try {
      await tutorApi.deleteExam(exam.id);
      forgetBuilder(exam.id);
      toast("Draft deleted");
      onDeleted();
    } catch (e) {
      toast(toApiError(e).message, "error");
      onDeleted();
    }
    setAsking(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Delete draft ${name}`}
        title="Delete draft"
        onClick={() => setAsking(true)}
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-rose hover:text-rose-ink"
      >
        <Trash2 className="size-[18px]" aria-hidden />
      </button>
      <ConfirmModal open={asking} onClose={() => setAsking(false)} title="Delete this draft?" confirmLabel="Delete draft" tone="dark" onConfirm={remove}>
        <p>
          &quot;{name}&quot; and its {plural(exam.questionCount, "question")} will be removed for good. This can&apos;t be undone.
        </p>
      </ConfirmModal>
    </>
  );
}

function ExamCard({ exam, onDeleted }: { exam: TutorExamRow; onDeleted: () => void }) {
  const stage = STAGE[exam.stage];
  const draft = exam.stage === "draft";
  const released = exam.stage === "released";
  const progress = progressOf(exam);

  return (
    <Card className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-[26px] px-[22px] py-5">
      <TiltTile tone={stage.tile} className="size-[52px] rounded-[17px]">
        <stage.Icon className="size-6" strokeWidth={2.3} aria-hidden />
      </TiltTile>

      <div className="flex min-w-0 flex-1 basis-[260px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-[19px] font-black">{exam.title}</h2>
          <StatusChip tone={stage.chip.tone} dot={stage.chip.dot}>
            {stage.chip.label}
          </StatusChip>
        </div>
        <span className="text-sm font-bold text-muted">
          {exam.timeLimitMinutes} min · {plural(exam.questionCount, "question")} · {plural(exam.totalMarks, "mark")}
          {!draft && " · answer key locked"}
        </span>
      </div>

      <div className="flex-1 basis-[200px] md:max-w-[220px]">
        <MiniProgress label={progress.label} value={progress.value} tone={progress.tone} />
      </div>

      {exam.classes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {exam.classes.slice(0, MAX_CHIPS).map((c) => (
            <StatusChip key={c.sessionId} tone={c.status === "open" ? "mint" : "neutral"} dot={c.status === "open" ? "bg-mint-ink" : undefined}>
              {classText(c)}
            </StatusChip>
          ))}
          {exam.classes.length > MAX_CHIPS && (
            <span title={exam.classes.slice(MAX_CHIPS).map(classText).join(", ")}>
              <StatusChip tone="neutral">+{exam.classes.length - MAX_CHIPS} more</StatusChip>
            </span>
          )}
        </div>
      )}

      {draft ? (
        <div className="flex items-center gap-1">
          <DeleteDraft exam={exam} onDeleted={onDeleted} />
          <ButtonLink href={`/tutor/exams/${exam.id}`} variant="soft" size="sm" className="h-11 px-[18px]">
            Continue editing
          </ButtonLink>
        </div>
      ) : released ? (
        <ButtonLink href={`/tutor/exams/${exam.id}/sessions`} variant="secondary" size="sm" className="h-11 px-[18px]">
          View results
        </ButtonLink>
      ) : (
        <ButtonLink href={`/tutor/exams/${exam.id}/sessions`} variant="dark" size="sm" className="h-11 px-[18px]">
          Manage
        </ButtonLink>
      )}
    </Card>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading your exams">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
        <Skeleton className="h-24 rounded-3xl" />
      </div>
      <Skeleton className="h-28 rounded-[26px]" />
      <Skeleton className="h-28 rounded-[26px]" />
    </div>
  );
}
