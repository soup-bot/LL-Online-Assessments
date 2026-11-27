"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Reorder, useDragControls } from "motion/react";
import { ArrowRight, Check, GripVertical, Loader2, Lock, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toApiError } from "@/lib/api";
import { tutorApi } from "@/lib/api-staff";
import type { ExamBuilder as ExamBuilderData } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { forgetBuilder, recallBuilder, rememberBuilder } from "@/lib/staff-snapshots";
import { KIND_META, KIND_ORDER } from "@/lib/question-kinds";
import { cn, plural } from "@/lib/utils";
import { BackLink, ConfirmModal, Field, Select, StatusChip, inputClass, textareaClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, ButtonLink, Card, ErrorState, KindBadge, Notice, ProgressBar, Skeleton } from "@/components/ui";

export function ExamBuilderScreen() {
  const params = useParams<{ examId: string }>();
  const examId = Number(params.examId);
  // The copy from the last visit shows at once (coming back from the question editor) while a fresh one loads quietly.
  const { data, error, loading, reload, refresh } = useAsync(() => tutorApi.builder(examId), [examId], { initial: recallBuilder(examId) });
  useEffect(() => {
    if (data) rememberBuilder(data);
  }, [data]);

  return (
    <>
      <StaffMain>
        <BackLink href="/tutor">My exams</BackLink>
        {loading && <BuilderSkeleton />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={error.code === "network" ? reload : undefined} backHref="/tutor" backLabel="Back to my exams" />}
        {data && <BuilderContent key={data.id} data={data} onChange={refresh} />}
      </StaffMain>
    </>
  );
}

function BuilderContent({ data, onChange }: { data: ExamBuilderData; onChange: () => void | Promise<void> }) {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const locked = !data.canEdit;

  async function publish() {
    try {
      await tutorApi.publish(data.id);
      toast("Exam published. Open it for a class when you're ready.");
      router.push(`/tutor/exams/${data.id}/sessions`);
    } catch (e) {
      setConfirming(false);
      toast(toApiError(e).message, "error");
      onChange();
    }
  }

  async function remove() {
    try {
      await tutorApi.deleteExam(data.id);
      forgetBuilder(data.id);
      toast("Draft deleted");
      router.push("/tutor");
    } catch (e) {
      setDeleting(false);
      toast(toApiError(e).message, "error");
      onChange();
    }
  }

  return (
    <>
      <Card className="flex flex-wrap items-center justify-between gap-5 px-[26px] py-6">
        <div className="relative flex min-w-0 flex-col gap-1.5">
          <span className="self-start">
            <StatusChip tone={data.status === "draft" ? "neutral" : "brand"}>{data.status === "draft" ? "Draft" : "Published"}</StatusChip>
          </span>
          <h1 className="text-[26px] font-black leading-tight md:text-3xl">{data.title.trim() || "Untitled exam"}</h1>
        </div>

        {data.status === "draft" ? (
          <div className="relative flex flex-wrap items-center gap-[18px]">
            <div className="flex min-w-[210px] flex-col gap-1.5">
              <span className="text-sm font-extrabold">
                {data.approvedCount} of {data.questions.length} approved
              </span>
              <ProgressBar
                className="h-2.5"
                value={data.questions.length ? (data.approvedCount / data.questions.length) * 100 : 0}
                label={`${data.approvedCount} of ${data.questions.length} questions approved`}
              />
              <span className="text-xs font-bold text-muted">
                {data.publishBlocker ?? "Ready. Publishing locks the answer key."}
              </span>
            </div>
            <Button size="lg" disabled={!data.canEdit || data.publishBlocker != null} onClick={() => setConfirming(true)}>
              Publish exam
            </Button>
            {data.canEdit && (
              <Button variant="ghost" size="md" className="text-rose-ink hover:bg-rose hover:text-rose-ink" onClick={() => setDeleting(true)}>
                <Trash2 className="size-[18px]" aria-hidden /> Delete draft
              </Button>
            )}
          </div>
        ) : (
          <ButtonLink href={`/tutor/exams/${data.id}/sessions`} variant="dark">
            Manage classes
          </ButtonLink>
        )}
      </Card>

      {data.status === "published" && (
        <Notice variant="info" title="This exam is published">
          Questions, answers and settings are locked so every student sits exactly the same paper.
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <SettingsCard data={data} locked={locked} onChange={onChange} />
        <QuestionsCard data={data} locked={locked} onChange={onChange} />
      </div>

      <ConfirmModal open={confirming} onClose={() => setConfirming(false)} title="Publish this exam?" confirmLabel="Publish" onConfirm={publish}>
        <p>
          Once it is published, the {plural(data.questions.length, "question")} and answer keys are locked and can&apos;t be edited. You
          can then open the exam for each class.
        </p>
      </ConfirmModal>
      <ConfirmModal open={deleting} onClose={() => setDeleting(false)} title="Delete this draft?" confirmLabel="Delete draft" tone="dark" onConfirm={remove}>
        <p>
          &quot;{data.title.trim() || "Untitled exam"}&quot; and its {plural(data.questions.length, "question")} will be removed for good. This can&apos;t be
          undone.
        </p>
      </ConfirmModal>
    </>
  );
}

/* ----------------------------------------------------------------- settings */

function SettingsCard({ data, locked, onChange }: { data: ExamBuilderData; locked: boolean; onChange: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(data.title);
  const [minutes, setMinutes] = useState(String(data.timeLimitMinutes));
  const [questionOrder, setQuestionOrder] = useState(data.questionOrder);
  const [rules, setRules] = useState(data.rules);
  const [classIds, setClassIds] = useState(data.classes.filter((c) => c.linked).map((c) => c.classId));
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const first = useRef(true);

  // Save a moment after the teacher stops typing, so there is no Save button to forget.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (locked) return;
    const mins = Number(minutes);
    if (!title.trim() || !Number.isFinite(mins) || mins < 1) return;
    setSaved("saving");
    const id = window.setTimeout(async () => {
      try {
        await tutorApi.updateExam(data.id, { title, timeLimitMinutes: mins, questionOrder, rules, classIds });
        setSaved("saved");
        onChange();
      } catch (e) {
        setSaved("idle");
        toast(toApiError(e).message, "error");
      }
    }, 600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, minutes, questionOrder, rules, classIds]);

  const invalidMinutes = !(Number(minutes) >= 1);

  return (
    <Card className="flex max-w-none flex-[1_1_320px] flex-col gap-4 p-[22px] lg:max-w-[380px]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[19px] font-black">Settings</h2>
        {!locked && (
          <span aria-live="polite" className="flex items-center gap-1 text-xs font-extrabold text-muted">
            {saved === "saving" && "Saving…"}
            {saved === "saved" && (
              <>
                <Check className="size-3.5 text-mint-ink" strokeWidth={3.5} aria-hidden /> Saved
              </>
            )}
          </span>
        )}
      </div>

      <Field label="Title">
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} disabled={locked} aria-invalid={!title.trim() || undefined} />
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Minutes">
          <input
            className={inputClass}
            type="number"
            min={1}
            max={600}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            disabled={locked}
            aria-invalid={invalidMinutes || undefined}
          />
        </Field>
        <Field label="Question order">
          <Select value={questionOrder} onChange={(e) => setQuestionOrder(e.target.value as ExamBuilderData["questionOrder"])} disabled={locked}>
            <option value="in_order">In order</option>
            <option value="random">Random</option>
          </Select>
        </Field>
      </div>

      <Field label="Rules for this exam" hint="Shown to students on the cover page, under the standard rules.">
        <textarea className={textareaClass} rows={3} value={rules} onChange={(e) => setRules(e.target.value)} disabled={locked} />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-extrabold">Classes</legend>
        {data.classes.length === 0 && <p className="text-sm font-bold text-muted">You don&apos;t have any classes yet. Ask an admin to set one up.</p>}
        {data.classes.map((c) => {
          const checked = classIds.includes(c.classId);
          return (
            <label
              key={c.classId}
              className={cn(
                "flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-extrabold transition",
                checked ? "bg-secondary-soft" : "bg-paper",
                !locked && "cursor-pointer",
              )}
            >
              <input
                type="checkbox"
                className="size-[18px] accent-secondary"
                checked={checked}
                disabled={locked}
                onChange={(e) => setClassIds((ids) => (e.target.checked ? [...ids, c.classId] : ids.filter((id) => id !== c.classId)))}
              />
              {c.name}
            </label>
          );
        })}
        <span className="text-xs font-bold text-muted">You&apos;ll open it for each class after publishing.</span>
      </fieldset>
    </Card>
  );
}

/* ---------------------------------------------------------------- questions */

/** One line under each question type on the "Add a question" tiles. */
const KIND_HINT = {
  mcq: "One correct of four",
  true_false: "Yes or no",
  fill_blank: "One gap in a sentence",
  written: "You mark it",
} as const;

function QuestionsCard({ data, locked, onChange }: { data: ExamBuilderData; locked: boolean; onChange: () => void | Promise<void> }) {
  const toast = useToast();
  // Every question being saved shows its own spinner. They all clear together once the last save has answered and the
  // refreshed list is on screen, so quick clicks on several questions never leave one showing its old state.
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());
  const pendingSaves = useRef(0);
  // The order on screen, as a list of question ids. The drag library tracks the ids, which never change, so a
  // refresh of the question data in the middle of (or just after) a drag can't confuse it.
  const serverIds = data.questions.map((q) => q.id);
  const [order, setOrder] = useState(serverIds);
  const orderRef = useRef(order);
  const savedOrder = useRef(serverIds.join(","));
  const busyMoving = useRef(0);

  // Follow the server when it differs (a question added or deleted, a failed save), but never while a drag or a save is under way.
  useEffect(() => {
    const ids = data.questions.map((q) => q.id);
    if (busyMoving.current > 0 || ids.join(",") === orderRef.current.join(",")) return;
    orderRef.current = ids;
    savedOrder.current = ids.join(",");
    setOrder(ids);
  }, [data.questions]);

  const byId = new Map(data.questions.map((q) => [q.id, q]));
  const items = order.map((id) => byId.get(id)).filter((q): q is (typeof data.questions)[number] => q !== undefined);

  function arrange(next: number[]) {
    orderRef.current = next;
    setOrder(next);
  }

  /** Saves the order if it changed. A failed save puts the server's order back. */
  async function saveOrder() {
    const ids = orderRef.current;
    if (ids.join(",") === savedOrder.current) return;
    savedOrder.current = ids.join(",");
    busyMoving.current += 1;
    try {
      await tutorApi.reorderQuestions(data.id, ids);
    } catch (e) {
      toast(toApiError(e).message, "error");
      savedOrder.current = "";
      orderRef.current = [];
    } finally {
      busyMoving.current -= 1;
    }
    onChange();
  }

  /** Keyboard and tap alternative to dragging: arrow keys on the handle move a question one place. */
  function move(from: number, to: number) {
    if (to < 0 || to >= orderRef.current.length) return;
    const next = [...orderRef.current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    arrange(next);
    void saveOrder();
    window.requestAnimationFrame(() => document.getElementById(`drag-${moved}`)?.focus());
  }

  async function toggle(id: number, approved: boolean) {
    pendingSaves.current += 1;
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await tutorApi.setApproved(data.id, id, approved);
      await onChange();
    } catch (e) {
      toast(toApiError(e).message, "error");
    } finally {
      pendingSaves.current -= 1;
      if (pendingSaves.current === 0) setBusyIds(new Set());
    }
  }

  const body = (q: (typeof items)[number], index: number) => (
    <QuestionRowBody q={q} number={index + 1} examId={data.id} locked={locked} busy={busyIds.has(q.id)} onToggle={(approved) => void toggle(q.id, approved)} />
  );

  return (
    <Card className="flex min-w-0 flex-[999_1_520px] flex-col gap-3 p-[22px]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[19px] font-black">Questions</h2>
        <span className="text-sm font-extrabold text-muted">
          {plural(data.questions.length, "question")} · {plural(data.totalMarks, "mark")}
        </span>
      </div>

      {data.questions.length === 0 && (
        <p className="rounded-2xl bg-paper px-4 py-6 text-center text-sm font-bold text-muted">No questions yet. Add your first one below.</p>
      )}

      {locked ? (
        <ol className="flex flex-col gap-2.5">
          {items.map((q, i) => (
            <li key={q.id} className="flex min-h-16 items-center gap-3 rounded-[20px] border border-[#f0ece5] bg-canvas px-3 py-2.5">
              {body(q, i)}
            </li>
          ))}
        </ol>
      ) : (
        <>
          {items.length > 1 && <p className="-mt-1 text-xs font-bold text-muted">Drag the handle to rearrange, or focus it and press the up and down arrow keys.</p>}
          <Reorder.Group as="ol" axis="y" values={order} onReorder={arrange} className="flex flex-col gap-2.5">
            {items.map((q, i) => (
              <SortableRow key={q.id} q={q} index={i} total={items.length} onMove={move} onDragStart={() => (busyMoving.current += 1)}
                onDragEnd={() => {
                  busyMoving.current = Math.max(0, busyMoving.current - 1);
                  void saveOrder();
                }}
              >
                {body(q, i)}
              </SortableRow>
            ))}
          </Reorder.Group>
        </>
      )}

      {!locked && (
        <div className="mt-2 flex flex-col gap-3">
          <h3 className="text-sm font-black">Add a question</h3>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {KIND_ORDER.map((kind) => (
              <Link
                key={kind}
                href={`/tutor/exams/${data.id}/questions/new?kind=${kind}`}
                className={cn(
                  "group flex flex-col gap-2 rounded-[20px] p-3.5 no-underline transition hover:-translate-y-0.5 hover:shadow-sm hover:brightness-[0.97]",
                  KIND_META[kind].bg,
                  KIND_META[kind].fg,
                  "hover:text-current",
                )}
              >
                <span className="flex items-center justify-between">
                  <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-white/70 text-sm font-black">
                    {KIND_META[kind].badge}
                  </span>
                  <Plus aria-hidden strokeWidth={3} className="size-4 opacity-60 transition group-hover:opacity-100" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-black">{KIND_META[kind].label}</span>
                  <span className="text-xs font-bold opacity-75">{KIND_HINT[kind]}</span>
                </span>
              </Link>
            ))}
          </div>
          <Link
            href={`/tutor/exams/${data.id}/import`}
            className="group flex items-center gap-3 rounded-[20px] border border-line bg-white px-4 py-3 text-ink no-underline transition hover:bg-paper hover:text-ink"
          >
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary-soft text-secondary">
              <Sparkles className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm font-black">Import many with AI</span>
              <span className="text-xs font-bold text-muted">Convert your own questions, or have an AI write them from notes, then check each one.</span>
            </span>
            <ArrowRight aria-hidden strokeWidth={3} className="size-4 shrink-0 text-secondary transition group-hover:translate-x-0.5" />
          </Link>
        </div>
      )}
    </Card>
  );
}

/** One question in the list, with a handle to drag it by. Only the handle drags, so the buttons and links still work. */
function SortableRow({
  q,
  index,
  total,
  onMove,
  onDragStart,
  onDragEnd,
  children,
}: {
  q: ExamBuilderData["questions"][number];
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  children: ReactNode;
}) {
  const controls = useDragControls();
  // The lifted look is ours, switched on and off by the drag events, so it can never get stuck.
  const [lifted, setLifted] = useState(false);
  return (
    <Reorder.Item
      as="li"
      value={q.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => {
        setLifted(true);
        onDragStart();
      }}
      onDragEnd={() => {
        setLifted(false);
        onDragEnd();
      }}
      animate={{ scale: lifted ? 1.015 : 1, boxShadow: lifted ? "0 14px 30px rgba(31,36,51,0.18)" : "0 0 0 rgba(31,36,51,0)" }}
      className={cn("relative flex min-h-16 items-center gap-2 rounded-[20px] border border-[#f0ece5] bg-canvas py-2.5 pl-1.5 pr-3", lifted && "z-10")}
    >
      <button
        type="button"
        id={`drag-${q.id}`}
        aria-label={`Move question ${index + 1} of ${total}. Drag it, or press the up or down arrow key.`}
        onPointerDown={(e) => {
          e.preventDefault();
          controls.start(e);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            onMove(index, index + (e.key === "ArrowUp" ? -1 : 1));
          }
        }}
        className="grid h-10 w-7 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-subtle transition hover:bg-chip hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="size-[18px]" strokeWidth={2.4} aria-hidden />
      </button>
      {children}
    </Reorder.Item>
  );
}

/** What a question row shows: its number and text, the approval switch and the edit link. */
function QuestionRowBody({
  q,
  number,
  examId,
  locked,
  busy,
  onToggle,
}: {
  q: ExamBuilderData["questions"][number];
  number: number;
  examId: number;
  locked: boolean;
  busy: boolean;
  onToggle: (approved: boolean) => void;
}) {
  return (
    <>
      <Link href={`/tutor/exams/${examId}/questions/${q.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink no-underline hover:text-ink">
        <KindBadge kind={q.kind} label={String(number)} className="size-10 shrink-0 rounded-[13px]" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-xs font-extrabold text-muted">
            {KIND_META[q.kind].label} · {plural(q.points, "mark")}
          </span>
          <span className="truncate text-sm font-bold">{q.prompt || "Untitled question"}</span>
        </span>
      </Link>

      {locked ? (
        <StatusChip tone={q.approved ? "mint" : "amber"}>{q.approved ? "Approved" : "Not approved"}</StatusChip>
      ) : (
        <button
          type="button"
          role="switch"
          aria-checked={q.approved}
          aria-label={`Question ${number} approved`}
          disabled={busy}
          aria-busy={busy}
          onClick={() => onToggle(!q.approved)}
          className={cn(
            "flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-black transition disabled:cursor-wait",
            q.approved ? "bg-mint text-mint-deep" : "border-2 border-line-input bg-white text-ink-2 hover:bg-paper",
          )}
        >
          {busy ? (
            <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" strokeWidth={3} />
          ) : (
            <span
              aria-hidden
              className={cn("grid size-4 place-items-center rounded-[5px]", q.approved ? "bg-mint-ink text-white" : "border-2 border-[#cfc9be] bg-white")}
            >
              {q.approved && <Check className="size-3" strokeWidth={4} />}
            </span>
          )}
          <span className="hidden sm:inline">{busy ? "Saving" : q.approved ? "Approved" : "Approve"}</span>
        </button>
      )}

      <Link
        href={`/tutor/exams/${examId}/questions/${q.id}`}
        aria-label={`${locked ? "View" : "Edit"} question ${number}`}
        className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-line-input bg-white text-ink-2 hover:bg-paper hover:text-ink"
      >
        {locked ? <Lock className="size-4" strokeWidth={2.6} aria-hidden /> : <Pencil className="size-4" strokeWidth={2.6} aria-hidden />}
      </Link>
    </>
  );
}

function BuilderSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading the exam">
      <Skeleton className="h-32 rounded-[28px]" />
      <div className="flex flex-wrap gap-5">
        <Skeleton className="h-96 flex-[1_1_320px] rounded-[28px]" />
        <Skeleton className="h-96 flex-[999_1_520px] rounded-[28px]" />
      </div>
    </div>
  );
}
