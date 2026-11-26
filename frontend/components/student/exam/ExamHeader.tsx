"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, CloudOff, LayoutGrid, LoaderCircle, Timer } from "lucide-react";
import { animate } from "motion/react";
import type { StudentQuestion } from "@/lib/api-types";
import { cn, formatClock, spokenDuration } from "@/lib/utils";
import { chipTone, currentChip, statusOf, type Answers, type QuestionStatus } from "@/components/student/exam/examStatus";
import type { SaveStatus } from "@/components/student/exam/useAutosave";
import { Logo } from "@/components/ui";

interface Props {
  title: string;
  subtitle: string;
  saveStatus: SaveStatus;
  online: boolean;
  remainingSec: number;
  questions: StudentQuestion[];
  answers: Answers;
  currentId: number;
  /** Jump straight to a question (by index). */
  onGo: (index: number) => void;
  onOpenSheet: () => void;
}

const statusWord: Record<QuestionStatus, string> = {
  answered: "answered",
  flagged: "marked to come back later",
  empty: "not answered yet",
};

function saveLabel(status: SaveStatus, online: boolean) {
  if (!online || status === "error") {
    return { text: "Offline · saved on this device", tone: "amber" as const, Icon: CloudOff };
  }
  if (status === "saving") return { text: "Saving…", tone: "neutral" as const, Icon: LoaderCircle };
  return { text: "All saved", tone: "mint" as const, Icon: Check };
}

export function ExamHeader({ title, subtitle, saveStatus, online, remainingSec, questions, answers, currentId, onGo, onOpenSheet }: Props) {
  const save = saveLabel(saveStatus, online);
  const urgent = remainingSec <= 60;
  const warn = remainingSec <= 300 && !urgent; // last five minutes
  const clock = formatClock(remainingSec);

  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    const chip = el?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!el || !chip) return;
    el.scrollTo({ left: chip.offsetLeft - (el.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
  }, [currentId]);

  // The chip you land on swells with a spring, then settles back to normal size.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const chip = strip.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!chip) return;
    let cancelled = false;
    void (async () => {
      // a quick pop up, then a springy settle: no waiting for a first spring to finish
      await animate(chip, { scale: 1.2 }, { duration: 0.07, ease: "easeOut" });
      if (!cancelled) await animate(chip, { scale: 1 }, { type: "spring", stiffness: 520, damping: 15 });
    })();
    return () => {
      cancelled = true;
      void animate(chip, { scale: 1 }, { duration: 0.12 });
    };
  }, [currentId]);

  // Flagged ("come back to") chips that have scrolled out of view on the left.
  const [hint, setHint] = useState<{ flagged: number; target: number } | null>(null);
  const computeHint = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    // a chip counts as out of view only once it has fully scrolled off the left edge
    const cutoff = el.scrollLeft + 2;
    let flagged = 0;
    let target = -1;
    for (let i = 0; i < questions.length; i++) {
      const chip = el.children[i] as HTMLElement | undefined;
      if (!chip || chip.offsetLeft + chip.offsetWidth > cutoff) break;
      if (statusOf(questions[i], answers) === "flagged") {
        flagged++;
        target = i;
      }
    }
    setHint((prev) => {
      if (target === -1) return null;
      return prev && prev.flagged === flagged && prev.target === target ? prev : { flagged, target };
    });
  }, [questions, answers]);

  useEffect(() => {
    computeHint();
  }, [computeHint, currentId]);

  const timer = (
    <span className="relative shrink-0">
      <span
        role="timer"
        aria-label={`Time left ${spokenDuration(remainingSec)}`}
        className={cn(
          "relative flex h-10 items-center gap-2 rounded-full px-3.5 text-[19px] font-black tabular-nums transition-colors lg:h-11 lg:px-[18px] lg:text-[22px]",
          urgent ? "ll-glow-fast bg-peach-mid text-[#8a3409]" : warn ? "ll-glow bg-amber text-amber-ink" : "bg-secondary-soft text-secondary-dark",
        )}
      >
        <Timer className="hidden size-[18px] lg:block" strokeWidth={2.5} aria-hidden />
        {clock}
      </span>
    </span>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line-header bg-white">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-[18px] lg:px-7 lg:py-3">
        {/* title row */}
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 lg:gap-3.5">
          <div className="flex min-w-0 items-center gap-3.5">
            <Logo className="hidden h-11 w-auto shrink-0 lg:block" />
            <div className="flex min-w-0 flex-col gap-0.5 lg:gap-px">
              <h1 className="truncate text-[15px] font-extrabold lg:text-[17px]">{title}</h1>
              <p className="hidden truncate text-[13px] font-semibold text-muted lg:block">{subtitle}</p>
              <p
                role="status"
                className={cn(
                  "flex items-center gap-1 text-xs font-extrabold lg:hidden",
                  save.tone === "mint" && "text-mint-ink",
                  save.tone === "amber" && "text-amber-ink",
                  save.tone === "neutral" && "text-muted",
                )}
              >
                <save.Icon className={cn("size-3", save.tone === "neutral" && "animate-spin")} strokeWidth={3} aria-hidden />
                {save.text}
              </p>
            </div>
          </div>
          <div className="lg:hidden">{timer}</div>
        </div>

        {/* desktop: save pill + timer */}
        <p
          role="status"
          className={cn(
            "hidden h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-extrabold lg:flex",
            save.tone === "mint" && "bg-mint text-mint-ink",
            save.tone === "amber" && "bg-amber text-amber-ink",
            save.tone === "neutral" && "bg-chip text-muted",
          )}
        >
          <save.Icon className={cn("size-[15px]", save.tone === "neutral" && "animate-spin")} strokeWidth={3} aria-hidden />
          {save.text}
        </p>
        <div className="hidden lg:block">{timer}</div>

        {/* phones: swipeable numbered chips (works for any length), plus the full list */}
        <div className="-my-1.5 flex items-center gap-2 lg:hidden">
          <div className="relative min-w-0 flex-1">
            <div
              ref={strip}
              role="navigation"
              aria-label="Questions"
              onScroll={computeHint}
              className="no-scrollbar relative flex gap-1.5 overflow-x-auto py-2 [mask-image:linear-gradient(to_right,transparent,black_14px,black_calc(100%-14px),transparent)]"
            >
              {questions.map((q, i) => {
                const status = statusOf(q, answers);
                const current = q.id === currentId;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onGo(i)}
                    aria-label={`Question ${q.position}, ${statusWord[status]}`}
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-full text-sm font-black transition-colors",
                      current ? currentChip : chipTone[status],
                    )}
                  >
                    {q.position}
                  </button>
                );
              })}
            </div>

            {hint && (
              <button
                type="button"
                onClick={() => onGo(hint.target)}
                aria-label={`${hint.flagged} earlier ${hint.flagged === 1 ? "question is" : "questions are"} marked to come back to. Go to the nearest one.`}
                className="absolute left-0 top-1/2 z-20 flex h-9 -translate-y-1/2 items-center gap-1.5 rounded-full bg-white pl-1 pr-2.5 shadow-[0_0_0_1px_var(--color-line),0_2px_8px_rgb(0_0_0/0.08)]"
              >
                <ChevronLeft className="size-4" strokeWidth={3} aria-hidden />
                <span aria-hidden className="size-2.5 rounded-full bg-amber-line" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenSheet}
            aria-label="Open question list"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-chip text-ink"
          >
            <LayoutGrid className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
