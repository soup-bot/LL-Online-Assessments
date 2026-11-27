"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Check, Lock, Pencil, Sparkles, Trash2 } from "lucide-react";
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

function BuilderContent({ data, onChange }: { data: ExamBuilderData; onChange: () => void }) {
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
  const [navigation, setNavigation] = useState(data.navigation);
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
        await tutorApi.updateExam(data.id, { title, timeLimitMinutes: mins, navigation, rules, classIds });
        setSaved("saved");
        onChange();
      } catch (e) {
        setSaved("idle");
        toast(toApiError(e).message, "error");
      }
    }, 600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, minutes, navigation, rules, classIds]);

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
        <Field label="Order">
          <Select value={navigation} onChange={(e) => setNavigation(e.target.value as ExamBuilderData["navigation"])} disabled={locked}>
            <option value="any">Any order</option>
            <option value="in_order">In order only</option>
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

function QuestionsCard({ data, locked, onChange }: { data: ExamBuilderData; locked: boolean; onChange: () => void }) {
  const toast = useToast();
  const [busyId, setBusyId] = useState<number | null>(null);

  async function toggle(id: number, approved: boolean) {
    setBusyId(id);
    try {
      await tutorApi.setApproved(data.id, id, approved);
      onChange();
    } catch (e) {
      toast(toApiError(e).message, "error");
    } finally {
      setBusyId(null);
    }
  }

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

      <ol className="flex flex-col gap-2.5">
        {data.questions.map((q) => (
          <li key={q.id} className="flex min-h-16 items-center gap-3 rounded-[20px] border border-[#f0ece5] bg-canvas px-3 py-2.5">
            <Link href={`/tutor/exams/${data.id}/questions/${q.id}`} className="flex min-w-0 flex-1 items-center gap-3 text-ink no-underline hover:text-ink">
              <KindBadge kind={q.kind} label={String(q.position)} className="size-10 shrink-0 rounded-[13px]" />
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
                aria-label={`Question ${q.position} approved`}
                disabled={busyId === q.id}
                onClick={() => void toggle(q.id, !q.approved)}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-black transition",
                  q.approved ? "bg-mint text-mint-deep" : "border-2 border-line-input bg-white text-ink-2 hover:bg-paper",
                )}
              >
                <span
                  aria-hidden
                  className={cn("grid size-4 place-items-center rounded-[5px]", q.approved ? "bg-mint-ink text-white" : "border-2 border-[#cfc9be] bg-white")}
                >
                  {q.approved && <Check className="size-3" strokeWidth={4} />}
                </span>
                <span className="hidden sm:inline">{q.approved ? "Approved" : "Approve"}</span>
              </button>
            )}

            <Link
              href={`/tutor/exams/${data.id}/questions/${q.id}`}
              aria-label={`${locked ? "View" : "Edit"} question ${q.position}`}
              className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-line-input bg-white text-ink-2 hover:bg-paper hover:text-ink"
            >
              {locked ? <Lock className="size-4" strokeWidth={2.6} aria-hidden /> : <Pencil className="size-4" strokeWidth={2.6} aria-hidden />}
            </Link>
          </li>
        ))}
      </ol>

      {!locked && (
        <div className="mt-1 flex flex-wrap items-center gap-2.5 rounded-[20px] border-2 border-dashed border-[#e0d9ce] p-3.5">
          <span className="mr-1 text-sm font-black">Add a question:</span>
          {KIND_ORDER.map((kind) => (
            <ButtonLink
              key={kind}
              href={`/tutor/exams/${data.id}/questions/new?kind=${kind}`}
              variant="ghost"
              size="sm"
              className={cn("h-[38px] px-3.5 text-[13px] font-black", KIND_META[kind].bg, KIND_META[kind].fg, "hover:brightness-95 hover:text-current")}
            >
              {KIND_META[kind].label}
            </ButtonLink>
          ))}
          <span aria-hidden className="mx-1 hidden h-[26px] w-px bg-[#e6e0d6] sm:block" />
          <ButtonLink href={`/tutor/exams/${data.id}/import`} size="sm" className="h-[38px] px-4 text-[13px]">
            <Sparkles className="size-4" aria-hidden /> Import a whole exam with AI
          </ButtonLink>
        </div>
      )}
    </Card>
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
