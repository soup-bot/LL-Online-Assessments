"use client";

import { Check, CloudOff, LayoutGrid, LoaderCircle, Timer } from "lucide-react";
import type { StudentQuestion } from "@/lib/api-types";
import { cn, formatClock, spokenDuration } from "@/lib/utils";
import { statusOf, type Answers, type Tally } from "@/components/student/exam/examStatus";
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
  tally: Tally;
  onOpenSheet: () => void;
}

const segment = {
  answered: "bg-brand",
  flagged: "bg-amber-line",
  empty: "bg-[#e2ddd3]",
} as const;

function saveLabel(status: SaveStatus, online: boolean) {
  if (!online || status === "error") {
    return { text: "Offline · saved on this device", tone: "amber" as const, Icon: CloudOff };
  }
  if (status === "saving") return { text: "Saving…", tone: "neutral" as const, Icon: LoaderCircle };
  return { text: "All saved", tone: "mint" as const, Icon: Check };
}

export function ExamHeader({ title, subtitle, saveStatus, online, remainingSec, questions, answers, currentId, tally, onOpenSheet }: Props) {
  const save = saveLabel(saveStatus, online);
  const urgent = remainingSec <= 60;
  const clock = formatClock(remainingSec);

  const timer = (
    <span
      role="timer"
      aria-label={`Time left ${spokenDuration(remainingSec)}`}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-[19px] font-black tabular-nums transition-colors lg:h-11 lg:px-[18px] lg:text-[22px]",
        urgent ? "bg-peach-mid text-[#8a3409]" : "bg-brand-tint text-brand-dark",
      )}
    >
      <Timer className="hidden size-[18px] lg:block" strokeWidth={2.5} aria-hidden />
      {clock}
    </span>
  );

  return (
    <header className="sticky top-0 z-20 border-b border-line-header bg-white">
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center lg:gap-[18px] lg:px-7 lg:py-3">
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

        {/* phones: progress strip + button to open the question list */}
        <div className="flex items-center gap-3 lg:hidden">
          <div aria-hidden className="flex h-3 flex-1 items-center gap-1">
            {questions.length <= 24 &&
              questions.map((q) => (
                <span
                  key={q.id}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-all",
                    segment[statusOf(q, answers)],
                    q.id === currentId && "h-3 ring-2 ring-ink/80 ring-offset-1",
                  )}
                />
              ))}
          </div>
          <button
            type="button"
            onClick={onOpenSheet}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-chip px-3 text-[13px] font-extrabold text-ink active:scale-95"
          >
            <LayoutGrid className="size-4" aria-hidden />
            {tally.answered} of {tally.total} done
          </button>
        </div>
      </div>
    </header>
  );
}
