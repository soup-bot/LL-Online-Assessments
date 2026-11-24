"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Check, Flag, X } from "lucide-react";
import type { StudentQuestion } from "@/lib/api-types";
import { KIND_META } from "@/lib/question-kinds";
import { cn, plural } from "@/lib/utils";
import type { LocalAnswer } from "@/components/student/exam/examStatus";
import { Card, Chip, TextArea, TextInput } from "@/components/ui";

interface Props {
  question: StudentQuestion;
  total: number;
  answer: LocalAnswer | undefined;
  onChange: (response: string, immediate: boolean) => void;
  onToggleFlag: () => void;
}

/** Shows a prompt, turning runs of underscores into a visible blank. */
function Prompt({ text }: { text: string }): ReactNode {
  return text.split(/(_{3,})/).map((part, i) =>
    /^_{3,}$/.test(part) ? (
      <span key={i} className="mx-1 inline-block w-20 border-b-[3px] border-ink align-baseline">
        <span className="sr-only">(blank)</span>
      </span>
    ) : (
      part
    ),
  );
}

export function QuestionView({ question, total, answer, onChange, onToggleFlag }: Props) {
  const meta = KIND_META[question.kind];
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const flagged = answer?.flagged ?? false;

  // Moving to another question moves focus to its prompt, so screen readers announce it.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
  }, [question.id]);

  return (
    <div className="flex flex-col gap-3.5 md:gap-5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid size-[46px] shrink-0 -rotate-6 place-items-center rounded-2xl text-sm font-black md:size-[54px] md:rounded-[18px] md:text-base",
              meta.bg,
              meta.fg,
            )}
          >
            {meta.badge}
          </span>
          <div className="flex flex-col gap-px">
            <p className="text-lg font-black md:text-2xl">
              Question {question.position} <span className="font-extrabold text-subtle">of {total}</span>
            </p>
            <p className="text-[13px] font-bold text-muted md:text-sm">
              {meta.label} · {plural(question.points, "mark")}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-pressed={flagged}
          onClick={onToggleFlag}
          className={cn(
            "flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-sm font-extrabold transition active:scale-95",
            flagged ? "border-amber-line bg-amber text-amber-ink" : "border-line-input bg-white text-ink-2 hover:bg-paper",
          )}
        >
          <Flag className="size-4" fill={flagged ? "currentColor" : "none"} aria-hidden />
          {flagged ? (
            <>
              <span className="sm:hidden">Marked</span>
              <span className="hidden sm:inline">Coming back</span>
            </>
          ) : (
            "Later"
          )}
        </button>
      </div>

      <Card className="flex flex-col gap-[18px] rounded-[26px] p-[22px] md:gap-6 md:rounded-[30px] md:p-8">
        <Chip size="md" className={cn("self-start", meta.bg, meta.fg)}>
          {meta.tag}
        </Chip>
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-extrabold leading-[1.4] outline-none md:text-[26px] md:leading-[1.35]">
          <Prompt text={question.prompt} />
        </h1>

        {question.kind === "mcq" && <McqOptions question={question} value={answer?.response ?? null} onPick={(v) => onChange(v, true)} />}
        {question.kind === "true_false" && <TrueFalse question={question} value={answer?.response ?? null} onPick={(v) => onChange(v, true)} />}
        {question.kind === "fill_blank" && <FillBlank value={answer?.response ?? ""} onChange={(v) => onChange(v, false)} />}
        {question.kind === "written" && <Written value={answer?.response ?? ""} onChange={(v) => onChange(v, false)} />}
      </Card>
    </div>
  );
}

const optionBase =
  "relative flex cursor-pointer items-center rounded-[18px] border-2 border-line-input bg-white font-bold leading-snug transition hover:border-brand/40 has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:ring-4 has-focus-visible:ring-brand-ring";

function McqOptions({
  question,
  value,
  onPick,
}: {
  question: StudentQuestion;
  value: string | null;
  onPick: (v: string) => void;
}) {
  const group = useId();
  return (
    <div role="radiogroup" aria-label="Answer options" className="flex flex-col gap-2.5 md:gap-3">
      {question.options?.map((o) => (
        <label key={o.key} className={cn(optionBase, "min-h-[58px] gap-3 px-3 py-2.5 text-base md:min-h-16 md:gap-4 md:px-4 md:text-lg")}>
          <input
            type="radio"
            name={`${group}-${question.id}`}
            value={o.key}
            checked={value === o.key}
            onChange={() => onPick(o.key)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="grid size-9 shrink-0 place-items-center rounded-full bg-chip text-[15px] font-black text-ink-2 peer-checked:bg-brand peer-checked:text-white md:size-10"
          >
            {o.key}
          </span>
          <span className="flex-1">{o.text}</span>
        </label>
      ))}
    </div>
  );
}

function TrueFalse({
  question,
  value,
  onPick,
}: {
  question: StudentQuestion;
  value: string | null;
  onPick: (v: string) => void;
}) {
  const group = useId();
  const choices = [
    { key: "true", label: "True", Icon: Check },
    { key: "false", label: "False", Icon: X },
  ];
  return (
    <div role="radiogroup" aria-label="True or false" className="grid grid-cols-2 gap-2.5 md:gap-3.5">
      {choices.map(({ key, label, Icon }) => (
        <label
          key={key}
          className={cn(optionBase, "min-h-[120px] flex-col justify-center gap-2.5 text-xl font-black md:min-h-[150px] md:text-2xl")}
        >
          <input
            type="radio"
            name={`${group}-${question.id}`}
            value={key}
            checked={value === key}
            onChange={() => onPick(key)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="grid size-12 place-items-center rounded-full bg-chip text-ink-2 peer-checked:bg-brand peer-checked:text-white md:size-14"
          >
            <Icon className="size-6" strokeWidth={3} />
          </span>
          {label}
        </label>
      ))}
    </div>
  );
}

function FillBlank({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-sm font-extrabold">
        Your answer
      </label>
      <TextInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Type the missing word"
        className="h-14 text-lg font-bold"
      />
      <p className="text-[13px] font-semibold text-muted">Capital letters and extra spaces don&apos;t matter.</p>
    </div>
  );
}

function Written({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-sm font-extrabold">
        Your answer
      </label>
      <TextArea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer here"
        spellCheck
        className="min-h-60 md:min-h-72"
      />
      <p className="text-[13px] font-semibold text-muted" aria-live="off">
        {plural(words, "word")}
      </p>
    </div>
  );
}
