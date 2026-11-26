"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ChevronsUpDown, Hourglass, Pencil, Plus, Radio, Search, Send, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { toApiError } from "@/lib/api";
import { tutorApi } from "@/lib/api-staff";
import type { ExamStage, TutorExamRow, TutorHome } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn, plural } from "@/lib/utils";
import { FilterPill, MiniProgress, PageHeader, Pagination, Select, StatusChip, TiltTile, inputClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, ButtonLink, Card, EmptyState, ErrorState, Skeleton, TileWatermark } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

type Filter = "all" | "drafts" | "published" | "marking";
type SortKey = "attention" | "recent" | "name" | "progress";
type SortState = { key: SortKey; dir: "asc" | "desc" };

/** Exams shown at first, and added each time "Show more" is pressed. */
const PAGE = 10;

const STAGE_ORDER: Record<ExamStage, number> = { live: 0, marking: 1, draft: 2, ready: 3, released: 4 };

/** Ascending order for each column: "attention" puts what needs the teacher first. */
const SORTS: Record<SortKey, (a: TutorExamRow, b: TutorExamRow) => number> = {
  attention: (a, b) => b.toMark - a.toMark || STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || b.id - a.id,
  recent: (a, b) => b.id - a.id,
  name: (a, b) => a.title.localeCompare(b.title),
  progress: (a, b) => progressOf(a).value - progressOf(b).value,
};

const FILTERS: { id: Filter; label: string }[] = [
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
  released: { Icon: Trophy, tile: "bg-secondary-soft text-secondary", chip: { tone: "mint", label: "Results released" } },
};

export function ExamsListScreen() {
  const { data, error, loading, reload } = useAsync(() => tutorApi.home(), []);

  return (
    <>
      <StaffMain>
        {loading && <ListSkeleton />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/login" backLabel="Back to sign in" />}
        {data && <ListContent data={data} />}
      </StaffMain>
    </>
  );
}

function ListContent({ data }: { data: TutorHome }) {
  const router = useRouter();
  const toast = useToast();
  // Start on what needs the teacher most: exams with submissions waiting to be marked.
  const [filter, setFilter] = useState<Filter>(data.stats.toMark > 0 ? "marking" : "all");
  const [starting, setStarting] = useState<"new" | "import" | null>(null);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>({ key: "attention", dir: "asc" });
  // Desktop pages through the table; phones keep adding cards with "Show more".
  const [limit, setLimit] = useState(PAGE);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE);
  const resetPaging = () => {
    setLimit(PAGE);
    setPage(0);
  };

  const labels = [...new Set(data.exams.flatMap((e) => e.classes.map((c) => c.label)))];
  const q = query.trim().toLowerCase();
  const matched = data.exams
    .filter((e) => (filter === "all" ? true : filter === "drafts" ? e.status === "draft" : filter === "published" ? e.status === "published" : e.toMark > 0))
    .filter((e) => !q || e.title.toLowerCase().includes(q))
    .sort((a, b) => (sort.dir === "asc" ? 1 : -1) * SORTS[sort.key](a, b));
  const shown = matched.slice(0, limit);
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  const current = Math.min(page, pages - 1);
  const pageRows = matched.slice(current * pageSize, (current + 1) * pageSize);

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

  return (
    <>
      <PageHeader
        title="My exams"
        subtitle={
          labels.length
            ? `Your classes: ${labels.slice(0, 3).join(", ")}${labels.length > 3 ? ` and ${labels.length - 3} more` : ""}`
            : "Build an exam, then open it for a class."
        }
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
        <StatTile src="/clock-green.png" tone="bg-mint" value={data.stats.open} label="Open right now" valueClass="text-mint-deep" labelClass="text-mint-deep" />
        <StatTile src="/pencil-amber.png" tone="bg-amber" value={data.stats.toMark} label={data.stats.toMark === 1 ? "Submission to mark" : "Submissions to mark"} valueClass="text-amber-ink" labelClass="text-[#7a4d00]" />
        <StatTile src="/question-blue.png" tone="bg-sky" value={data.stats.drafts} label={data.stats.drafts === 1 ? "Draft in progress" : "Drafts in progress"} valueClass="text-sky-deep" labelClass="text-sky-deep" />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter exams">
          {FILTERS.map((f) => (
            <FilterPill
              key={f.id}
              active={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                resetPaging();
              }}
            >
              {f.label}
            </FilterPill>
          ))}
        </div>
        {(
          <div className="ml-auto flex w-full flex-wrap items-center gap-2.5 md:w-auto md:flex-nowrap">
            <label className="sr-only" htmlFor="exam-search">Search exams</label>
            <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
              <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" strokeWidth={3} />
              <input
                id="exam-search"
                type="search"
                value={query}
                placeholder="Search exams"
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPaging();
                }}
                className={cn(inputClass, "h-10 rounded-full pl-10 pr-4 text-sm")}
              />
            </div>
            <label className="sr-only" htmlFor="exam-sort">Sort exams</label>
            <Select id="exam-sort" value={sort.key} onChange={(e) => setSort({ key: e.target.value as SortKey, dir: "asc" })} className="h-10 w-auto! rounded-full text-sm md:hidden">
              <option value="attention">Needs attention first</option>
              <option value="recent">Newest first</option>
              <option value="name">Name A to Z</option>
            </Select>
          </div>
        )}
      </div>

      {data.exams.length === 0 ? (
        <EmptyState title="No exams yet" Icon={Pencil}>
          Start a new exam, or let an AI tool turn your Word file into one.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState title="Nothing here" Icon={Pencil}>
          No exams match{q ? ` "${query.trim()}"` : " that filter"}.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <ExamTable exams={pageRows} sort={sort} onSort={(s) => { setSort(s); setPage(0); }} />
          <Pagination
            className="hidden md:flex"
            total={matched.length}
            page={current}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(n) => {
              setPageSize(n);
              setPage(0);
            }}
          />
          <div className="flex flex-col gap-3 md:hidden">
            {shown.map((exam) => (
              <ExamCard key={exam.id} exam={exam} />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 md:hidden">
            <span className="text-sm font-bold text-muted">
              Showing {shown.length} of {matched.length}
            </span>
            {matched.length > shown.length && (
              <Button variant="secondary" size="md" onClick={() => setLimit((n) => n + PAGE)}>
                Show {Math.min(PAGE, matched.length - shown.length)} more
              </Button>
            )}
          </div>
        </div>
      )}
    </>
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
    tone: "bg-secondary",
  };
}

/** The one button on the row of an exam. */
function action(exam: TutorExamRow) {
  if (exam.stage === "draft") return { href: `/tutor/exams/${exam.id}`, label: "Continue editing", variant: "soft" as const };
  if (exam.stage === "released") return { href: `/tutor/exams/${exam.id}/sessions`, label: "View results", variant: "secondary" as const };
  return { href: `/tutor/exams/${exam.id}/sessions`, label: "Manage", variant: "dark" as const };
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: SortState; onSort: (s: SortState) => void; className?: string }) {
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
function ExamTable({ exams, sort, onSort }: { exams: TutorExamRow[]; sort: SortState; onSort: (s: SortState) => void }) {
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
            <ExamTableRow key={exam.id} exam={exam} />
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function ExamTableRow({ exam }: { exam: TutorExamRow }) {
  const stage = STAGE[exam.stage];
  const progress = progressOf(exam);
  const act = action(exam);
  const open = exam.classes.filter((c) => c.status === "open").length;
  const href = exam.stage === "draft" ? `/tutor/exams/${exam.id}` : `/tutor/exams/${exam.id}/sessions`;

  return (
    <tr className="border-t border-line transition-colors first:border-t-0 hover:bg-canvas/70">
      <td className="py-3.5 pl-5 pr-4">
        <div className="flex items-center gap-3.5">
          <TiltTile tone={stage.tile} className="size-11 rounded-[14px]">
            <stage.Icon className="size-5" strokeWidth={2.3} aria-hidden />
          </TiltTile>
          <div className="flex min-w-0 flex-col gap-0.5">
            <Link href={href} className="text-[15px] font-black text-ink no-underline hover:text-secondary-dark">
              {exam.title}
            </Link>
            <span className="text-[13px] font-bold text-muted">
              {exam.timeLimitMinutes} min · {plural(exam.questionCount, "question")} · {plural(exam.totalMarks, "mark")}
            </span>
          </div>
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
        <MiniProgress label={progress.label} value={progress.value} tone={progress.tone} />
      </td>
      <td className="py-3.5 pl-4 pr-5">
        <ButtonLink href={act.href} variant={act.variant} size="sm">{act.label}</ButtonLink>
      </td>
    </tr>
  );
}

function ExamCard({ exam }: { exam: TutorExamRow }) {
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
        <ButtonLink href={`/tutor/exams/${exam.id}`} variant="soft" size="sm" className="h-11 px-[18px]">
          Continue editing
        </ButtonLink>
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
