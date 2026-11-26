"use client";

import { useState, type ReactNode } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { toApiError } from "@/lib/api";
import { tutorApi } from "@/lib/api-staff";
import type { EditorQuestion, QuestionDraft } from "@/lib/staff-types";
import { useAsync } from "@/lib/hooks/useAsync";
import { KIND_META, KIND_ORDER } from "@/lib/question-kinds";
import type { QuestionKind } from "@/lib/types";
import { cn, plural } from "@/lib/utils";
import { BackLink, ConfirmModal, Field, TiltTile, inputClass, textareaClass } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { useToast } from "@/components/staff/Toast";
import { Button, ButtonLink, Card, ErrorState, Notice, Skeleton } from "@/components/ui";

const OPTION_KEYS = ["A", "B", "C", "D"];
const BLANK = "________";

export function QuestionEditorScreen() {
  const params = useParams<{ examId: string; questionId: string }>();
  const search = useSearchParams();
  const examId = Number(params.examId);
  const questionId = params.questionId === "new" ? null : Number(params.questionId);
  const kindParam = search.get("kind");
  const kind = KIND_ORDER.includes(kindParam as QuestionKind) ? (kindParam as QuestionKind) : "mcq";
  const { data, error, loading, reload } = useAsync(() => tutorApi.question(examId, questionId, kind), [examId, questionId, kind]);

  return (
    <>
      <StaffMain>
        {loading && <Skeleton className="h-[34rem] rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={error.code === "network" ? reload : undefined} backHref={`/tutor/exams/${examId}`} backLabel="Back to the exam" />}
        {data && <EditorContent key={`${questionId}-${kind}`} examId={examId} data={data} />}
      </StaffMain>
    </>
  );
}

function EditorContent({ examId, data }: { examId: number; data: EditorQuestion }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<QuestionDraft>(data.draft);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const locked = data.locked;
  const back = `/tutor/exams/${examId}`;
  const isNew = data.id == null;

  /** Any edit removes the approval: the teacher has to check the key again. */
  function edit(patch: Partial<QuestionDraft>) {
    setProblem(null);
    setDraft((d) => ({ ...d, ...patch, approved: "approved" in patch ? !!patch.approved : false }));
  }

  async function save() {
    setSaving(true);
    setProblem(null);
    try {
      await tutorApi.saveQuestion(examId, data.id, draft);
      toast(draft.approved ? "Question saved and approved" : "Question saved");
      router.push(back);
    } catch (e) {
      setProblem(toApiError(e).message);
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await tutorApi.deleteQuestion(examId, data.id!);
      toast("Question deleted");
      router.push(back);
    } catch (e) {
      setDeleting(false);
      toast(toApiError(e).message, "error");
    }
  }

  const meta = KIND_META[draft.kind];

  return (
    <>
      <BackLink href={back}>{data.examTitle}</BackLink>
      <h1 className="text-[28px] font-black leading-tight md:text-3xl">{isNew ? `New question (number ${data.position})` : `Question ${data.position}`}</h1>

      {locked && (
        <Notice variant="info" title="This question is locked">
          The exam is published, so its questions and answer keys can no longer change.
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-5 p-5 md:p-[26px]">
          <fieldset disabled={locked} className="flex flex-col gap-5 border-0 p-0">
            <div>
              <legend className="mb-2.5 text-sm font-extrabold">Question type</legend>
              <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
                {KIND_ORDER.map((k) => {
                  const m = KIND_META[k];
                  const on = draft.kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => edit({ kind: k, prompt: k === "fill_blank" && !/_{3,}/.test(draft.prompt) && !draft.prompt.trim() ? `Type the sentence and put ${BLANK} where the blank goes.` : draft.prompt })}
                      className={cn(
                        "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 text-[13px] transition",
                        on ? cn("border-current font-black", m.fg, m.bg) : "border-line-input bg-white font-extrabold hover:bg-paper",
                      )}
                    >
                      <span aria-hidden className={cn("grid size-[30px] place-items-center rounded-[10px] text-xs font-black", m.bg, m.fg, on && "bg-white/70")}>
                        {m.badge}
                      </span>
                      {k === "written" ? "Written answer" : m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label="Question">
              <textarea className={cn(textareaClass, "text-base font-bold")} rows={3} value={draft.prompt} onChange={(e) => edit({ prompt: e.target.value })} />
              {draft.kind === "fill_blank" && (
                <span className="flex flex-wrap items-center gap-2 text-xs font-bold text-muted">
                  Use one blank per question. Students see it wherever the underscores are.
                  {!locked && !/_{3,}/.test(draft.prompt) && (
                    <button type="button" className="rounded-full bg-mint px-2.5 py-1 font-black text-mint-deep" onClick={() => edit({ prompt: `${draft.prompt}${draft.prompt.endsWith(" ") || !draft.prompt ? "" : " "}${BLANK}` })}>
                      Insert a blank
                    </button>
                  )}
                </span>
              )}
            </Field>

            <Field label="Marks" className="w-[150px]">
              <input
                className={cn(inputClass, "font-extrabold")}
                type="number"
                min={1}
                max={100}
                inputMode="numeric"
                value={Number.isFinite(draft.points) ? draft.points : ""}
                onChange={(e) => edit({ points: e.target.value === "" ? NaN : Math.round(Number(e.target.value)) })}
              />
            </Field>

            {draft.kind === "mcq" && <McqKey draft={draft} edit={edit} />}
            {draft.kind === "true_false" && <TrueFalseKey draft={draft} edit={edit} />}
            {draft.kind === "fill_blank" && <FillKey draft={draft} edit={edit} />}
            {draft.kind === "written" && <WrittenKey draft={draft} edit={edit} />}
          </fieldset>

          {problem && <Notice variant="error">{problem}</Notice>}

          {!locked && (
            <div className="flex flex-wrap items-center justify-between gap-3.5 border-t border-line-header pt-[18px]">
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-full px-3.5 py-2.5 text-sm font-black transition",
                  draft.approved ? "bg-mint text-mint-deep" : "bg-chip text-ink-2",
                )}
              >
                <input type="checkbox" className="size-[18px] accent-mint-ink" checked={draft.approved} onChange={(e) => edit({ approved: e.target.checked })} />
                Answer key checked · approve
              </label>
              <div className="flex flex-wrap gap-2.5">
                {!isNew && (
                  <Button variant="ghost" size="md" className="text-rose-ink hover:bg-rose hover:text-rose-ink" onClick={() => setDeleting(true)}>
                    <Trash2 className="size-[18px]" aria-hidden /> Delete
                  </Button>
                )}
                <ButtonLink href={back} variant="secondary" size="md">
                  Cancel
                </ButtonLink>
                <Button size="md" onClick={() => void save()} loading={saving}>
                  Save question
                </Button>
              </div>
            </div>
          )}
          {!locked && <span className="text-[13px] font-bold text-muted">Changing an approved question removes its approval.</span>}
        </Card>

        <aside className="flex max-w-none flex-[1_1_320px] flex-col gap-3 lg:max-w-[400px]">
          <h2 className="text-sm font-black uppercase tracking-wider text-muted">How students will see it</h2>
          <Card className="flex flex-col gap-3.5 rounded-[26px] p-[22px]">
            <div className="flex items-center gap-2.5">
              <TiltTile tone={cn(meta.bg, meta.fg)} className="size-10 -rotate-6 rounded-[14px] text-sm font-black">
                {meta.badge}
              </TiltTile>
              <div className="flex flex-col">
                <span className="text-[15px] font-black">
                  Question {data.position} of {data.total}
                </span>
                <span className="text-xs font-bold text-muted">
                  {meta.label} · {plural(Number.isFinite(draft.points) ? draft.points : 0, "mark")}
                </span>
              </div>
            </div>
            <Preview draft={draft} />
          </Card>
          {draft.kind === "written" && (
            <div className="rounded-[22px] bg-amber px-4 py-3.5 text-[13px] font-bold leading-relaxed text-[#6b4a00]">
              Marking points are never shown to students. They appear as a checklist when you mark.
            </div>
          )}
        </aside>
      </div>

      <ConfirmModal open={deleting} onClose={() => setDeleting(false)} title="Delete this question?" confirmLabel="Delete question" onConfirm={remove}>
        <p>The question and its answer key are removed from this draft. The questions after it move up one place.</p>
      </ConfirmModal>
    </>
  );
}

type KeyProps = { draft: QuestionDraft; edit: (p: Partial<QuestionDraft>) => void };

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[17px] font-black">{title}</h2>
        {aside && <span className="text-[13px] font-bold text-muted">{aside}</span>}
      </div>
      {children}
    </div>
  );
}

function McqKey({ draft, edit }: KeyProps) {
  return (
    <Section title="Answer options" aside="Tick the correct one">
      {OPTION_KEYS.map((key, i) => {
        const correct = draft.correct === key;
        return (
          <div key={key} className="flex items-center gap-2.5">
            <button
              type="button"
              role="radio"
              aria-checked={correct}
              aria-label={`Option ${key} is the correct answer`}
              onClick={() => edit({ correct: key })}
              className={cn(
                "grid size-[34px] shrink-0 place-items-center rounded-full text-[13px] font-black transition",
                correct ? "bg-mint-ink text-white" : "bg-pink text-pink-ink hover:brightness-95",
              )}
            >
              {key}
            </button>
            <input
              className={cn(inputClass, "h-11 rounded-[14px] text-sm", correct && "border-mint-ink")}
              aria-label={`Option ${key}`}
              placeholder={`Option ${key}`}
              value={draft.options[i] ?? ""}
              onChange={(e) => edit({ options: draft.options.map((o, j) => (j === i ? e.target.value : o)) })}
            />
          </div>
        );
      })}
    </Section>
  );
}

function TrueFalseKey({ draft, edit }: KeyProps) {
  return (
    <Section title="Correct answer">
      <div className="grid grid-cols-2 gap-2.5 sm:max-w-sm">
        {[true, false].map((v) => (
          <button
            key={String(v)}
            type="button"
            aria-pressed={draft.trueFalse === v}
            onClick={() => edit({ trueFalse: v })}
            className={cn(
              "h-14 rounded-2xl border-2 text-base font-black transition",
              draft.trueFalse === v ? "border-mint-ink bg-mint text-mint-deep" : "border-line-input bg-white hover:bg-paper",
            )}
          >
            {v ? "True" : "False"}
          </button>
        ))}
      </div>
    </Section>
  );
}

function ListEditor({
  items,
  onChange,
  placeholder,
  label,
  addLabel,
  badge,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  label: string;
  addLabel: string;
  badge: string;
}) {
  const rows = items.length ? items : [""];
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((text, i) => (
        <div key={i} className="flex items-center gap-2.5">
          <span aria-hidden className={cn("grid size-[30px] shrink-0 place-items-center rounded-full text-[13px] font-black", badge)}>
            {i + 1}
          </span>
          <input
            className={cn(inputClass, "h-11 min-w-0 flex-1 rounded-[14px] text-sm")}
            aria-label={`${label} ${i + 1}`}
            placeholder={placeholder}
            value={text}
            onChange={(e) => onChange(rows.map((t, j) => (j === i ? e.target.value : t)))}
          />
          <button
            type="button"
            aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-chip text-muted hover:bg-rose hover:text-rose-ink"
          >
            <X className="size-[18px]" strokeWidth={3} aria-hidden />
          </button>
        </div>
      ))}
      <Button variant="secondary" size="sm" className="self-start border-dashed" onClick={() => onChange([...rows, ""])}>
        <Plus className="size-4" strokeWidth={3} aria-hidden /> {addLabel}
      </Button>
    </div>
  );
}

function FillKey({ draft, edit }: KeyProps) {
  return (
    <Section title="Accepted answers">
      <ListEditor
        items={draft.accepted}
        onChange={(accepted) => edit({ accepted })}
        placeholder="An answer that earns the mark"
        label="Accepted answer"
        addLabel="Add another accepted answer"
        badge="bg-mint text-mint-deep"
      />
    </Section>
  );
}

function WrittenKey({ draft, edit }: KeyProps) {
  return (
    <Section title="Marking points" aside={`1 mark each · capped at ${Number.isFinite(draft.points) ? draft.points : 0}`}>
      <ListEditor
        items={draft.markingPoints}
        onChange={(markingPoints) => edit({ markingPoints })}
        placeholder="What a good answer says"
        label="Marking point"
        addLabel="Add marking point"
        badge="bg-peach text-peach-ink"
      />
    </Section>
  );
}

/** A quiet imitation of what the student sees. */
function Preview({ draft }: { draft: QuestionDraft }) {
  const prompt = draft.kind !== "fill_blank" ? draft.prompt || "Your question appears here." : (draft.prompt || "Your question appears here.").split(/(_{3,})/).map((part, i) =>
    /^_{3,}$/.test(part) ? <span key={i} className="mx-1 inline-block min-w-16 rounded-xl border-b-[3px] border-dashed border-mint-ink/70 bg-mint/60 px-3">&nbsp;</span> : part,
  );

  return (
    <>
      <p className="text-base font-extrabold leading-snug">{prompt}</p>
      {draft.kind === "mcq" && (
        <ul className="flex flex-col gap-2">
          {OPTION_KEYS.map((key, i) => (
            <li key={key} className="flex items-center gap-2.5 rounded-2xl border-2 border-line-input px-3 py-2.5 text-sm font-bold">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-pink text-xs font-black text-pink-ink">{key}</span>
              <span className={cn("min-w-0 break-words", !draft.options[i] && "text-subtle")}>{draft.options[i] || `Option ${key}`}</span>
            </li>
          ))}
        </ul>
      )}
      {draft.kind === "true_false" && (
        <div className="grid grid-cols-2 gap-2">
          {["True", "False"].map((t) => (
            <span key={t} className="grid h-12 place-items-center rounded-2xl border-2 border-line-input text-sm font-black">
              {t}
            </span>
          ))}
        </div>
      )}
      {draft.kind === "fill_blank" && <div className="h-12 rounded-full border-2 border-line-input bg-white px-4 py-3 text-sm font-medium text-subtle">Type your answer</div>}
      {draft.kind === "written" && <div className="h-[110px] rounded-[18px] border-2 border-line-input bg-[#fffdfb]" />}
    </>
  );
}
