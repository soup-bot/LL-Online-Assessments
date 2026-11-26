"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Check, Flag, X } from "lucide-react";
import { MotionConfig, motion } from "motion/react";
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
  /** 1 when moving forward, -1 when moving back: decides which way the card slides in. */
  direction?: 1 | -1;
}

/**
 * Display only: adds invisible soft hyphens inside long words, so if one has to wrap the
 * browser breaks it with a visible "-" instead of overflowing. The saved answer is untouched.
 */
function softHyphenate(text: string): string {
  // every 7 non-space characters that are followed by more of the same word
  return text.replace(/(\S{7})(?=\S)/g, "$1\u00ad");
}

/**
 * Shows a prompt, turning runs of underscores into a visible blank. For fill-in-the-blank
 * questions the blank is a mint pill that fills in live with what the student types.
 */
function Prompt({ text, fill }: { text: string; fill?: string }): ReactNode {
  // Only fill-in-the-blank questions turn underscores into a blank; elsewhere they are plain text.
  if (fill === undefined) return text;
  let usedBlank = false;
  return text.split(/(_{3,})/).map((part, i) => {
    if (!/^_{3,}$/.test(part)) return part;
    const value = !usedBlank ? (fill ?? "").trim() : "";
    usedBlank = true;
    return (
      <span
        key={i}
        className={cn(
          "mx-1 inline-block min-w-24 max-w-full hyphens-manual break-words rounded-xl border-b-[3px] px-3 text-center align-baseline transition-colors duration-150",
          value ? "border-mint-ink bg-mint font-black text-mint-deep" : "border-dashed border-mint-ink/70 bg-mint/60",
        )}
      >
        <span aria-hidden>{value ? softHyphenate(value) : " "}</span>
        <span className="sr-only">(blank)</span>
      </span>
    );
  });
}

/** Card slides in from the side we are travelling towards; its options follow one by one. */
const cardVariants = {
  // slide disabled for now: was `(d: number) => ({ opacity: 0, x: d * 32 })`
  hidden: { opacity: 1, x: 0 },
  show: { opacity: 1, x: 0, transition: { duration: 0.24, ease: "easeOut", staggerChildren: 0.04, delayChildren: 0.08 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } },
} as const;

/** A tiny tick on phones that support it (Android). Silent elsewhere. */
function buzz() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(8);
}

/** Selected-state colours per kind, taken from the design's pastel pairs (not the brand green). */
const tone = {
  mcq: {
    highlight: "border-pink-ink bg-pink",
    badge: "bg-pink-ink text-white",
    hover: "hover:border-pink-ink/40",
  },
  true_false: {
    highlight: "border-sky-ink bg-sky",
    badge: "bg-sky-ink text-white",
    hover: "hover:border-sky-ink/40",
  },
} as const;

/** The tinted highlight that glides from the old answer to the new one. */
function Highlight({ id, className }: { id: string; className: string }) {
  return (
    <motion.span
      layoutId={id}
      aria-hidden
      className={cn("absolute -inset-0.5 rounded-[18px] border-2", className)}
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
    />
  );
}

export function QuestionView({ question, total, answer, onChange, onToggleFlag, direction = 1 }: Props) {
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
    <MotionConfig reducedMotion="user">
    <div className="flex flex-col gap-3.5 overflow-x-clip md:gap-5">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center">
          <div className="flex flex-col gap-px">
            <p className="text-lg font-black md:text-2xl">
              Question {question.position} <span className="font-extrabold text-subtle">of {total}</span>
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

      <motion.div key={question.id} custom={direction} variants={cardVariants} initial={first.current ? false : "hidden"} animate="show">
      <Card className="flex flex-col gap-[18px] rounded-[26px] p-[22px] md:gap-6 md:rounded-[30px] md:p-8">
        <Chip size="md" className={cn("self-start", meta.bg, meta.fg)}>
          {meta.tag}
        </Chip>
        <h1 ref={headingRef} tabIndex={-1} className="text-xl font-extrabold leading-[1.4] outline-none md:text-[26px] md:leading-[1.35]">
          <Prompt text={question.prompt} fill={question.kind === "fill_blank" ? (answer?.response ?? "") : undefined} />
          <span className="ml-2 whitespace-nowrap text-base font-extrabold text-muted md:text-lg">({plural(question.points, "mark")})</span>
        </h1>

        {question.kind === "mcq" && <McqOptions question={question} value={answer?.response ?? null} onPick={(v) => onChange(v, true)} />}
        {question.kind === "true_false" && <TrueFalse question={question} value={answer?.response ?? null} onPick={(v) => onChange(v, true)} />}
        {question.kind === "fill_blank" && <FillBlank value={answer?.response ?? ""} onChange={(v) => onChange(v, false)} />}
        {question.kind === "written" && <Written value={answer?.response ?? ""} onChange={(v) => onChange(v, false)} />}
      </Card>
      </motion.div>
    </div>
    </MotionConfig>
  );
}

const optionBase =
  "relative flex cursor-pointer items-center rounded-[18px] border-2 border-line-input bg-white font-bold leading-snug transition-colors has-focus-visible:ring-4 has-focus-visible:ring-brand-ring";

/** Letter circle that fills green, pops, and swaps its letter for a tick that draws itself. */
function ChoiceBadge({ selected, letter, selectedClass }: { selected: boolean; letter: string; selectedClass: string }) {
  return (
    <motion.span
      aria-hidden
      animate={selected ? { scale: [1, 1.2, 1] } : { scale: 1 }}
      transition={{ duration: 0.26, ease: "easeOut" }}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-black transition-colors md:size-10",
        selected ? selectedClass : "bg-chip text-ink-2",
      )}
    >
      {selected ? (
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
          <motion.path d="m5 12.5 4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.22, ease: "easeOut" }} />
        </svg>
      ) : (
        letter
      )}
    </motion.span>
  );
}

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
      {question.options?.map((o) => {
        const selected = value === o.key;
        return (
          <motion.label
            key={o.key}
            variants={itemVariants}
            whileTap={{ scale: 0.985 }}
            whileHover={{ y: -1 }}
            className={cn(optionBase, tone.mcq.hover, "min-h-[58px] gap-3 px-3 py-2.5 text-base md:min-h-16 md:gap-4 md:px-4 md:text-lg")}
          >
            {selected && <Highlight id={`mcq-${question.id}`} className={tone.mcq.highlight} />}
            <input
              type="radio"
              name={`${group}-${question.id}`}
              value={o.key}
              checked={selected}
              onChange={() => {
                buzz();
                onPick(o.key);
              }}
              className="sr-only"
            />
            <ChoiceBadge selected={selected} letter={o.key} selectedClass={tone.mcq.badge} />
            <span className="relative flex-1">{o.text}</span>
          </motion.label>
        );
      })}
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
      {choices.map(({ key, label, Icon }) => {
        const selected = value === key;
        return (
          <motion.label
            key={key}
            variants={itemVariants}
            whileTap={{ scale: 0.97 }}
            whileHover={{ y: -1 }}
            className={cn(optionBase, tone.true_false.hover, "min-h-[120px] flex-col justify-center gap-2.5 text-xl font-black md:min-h-[150px] md:text-2xl")}
          >
            {selected && <Highlight id={`tf-${question.id}`} className={tone.true_false.highlight} />}
            <input
              type="radio"
              name={`${group}-${question.id}`}
              value={key}
              checked={selected}
              onChange={() => {
                buzz();
                onPick(key);
              }}
              className="sr-only"
            />
            <motion.span
              aria-hidden
              animate={selected ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className={cn(
                "relative grid size-12 place-items-center rounded-full transition-colors md:size-14",
                selected ? tone.true_false.badge : "bg-chip text-ink-2",
              )}
            >
              <Icon className="size-6" strokeWidth={3} />
            </motion.span>
            <span className="relative">{label}</span>
          </motion.label>
        );
      })}
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
