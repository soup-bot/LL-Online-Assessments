"use client";

import type { StudentQuestion } from "@/lib/api-types";
import { KIND_META } from "@/lib/question-kinds";
import { cn, plural } from "@/lib/utils";
import { statusOf, type Answers, type QuestionStatus, type Tally } from "@/components/student/exam/examStatus";
import { Button, Chip } from "@/components/ui";

const card: Record<QuestionStatus, string> = {
  answered: "border border-line bg-white",
  empty: "border-2 border-dashed border-[#d8d2c8] bg-white",
  flagged: "border-2 border-amber-line bg-amber-soft",
};

const chip: Record<QuestionStatus, { label: string; tone: "lilac" | "amber" | "neutral" }> = {
  answered: { label: "Answered", tone: "lilac" },
  flagged: { label: "Come back", tone: "amber" },
  empty: { label: "Not answered", tone: "neutral" },
};

/** Desktop "Ready to hand it in?" page: every question as a card, jump back to any of them. */
export function ReviewScreen({
  questions,
  answers,
  tally,
  onGo,
  onBack,
  onSubmit,
}: {
  questions: StudentQuestion[];
  answers: Answers;
  tally: Tally;
  onGo: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[34px] font-black leading-tight">Ready to hand it in?</h1>
          <p className="text-base font-bold text-muted">Have a last look. Tap any question to jump back to it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="lilac" className="h-[38px] px-3.5 text-sm">
            {tally.answered} answered
          </Chip>
          {tally.flagged.length > 0 && (
            <Chip tone="amber" className="h-[38px] px-3.5 text-sm">
              {tally.flagged.length} to come back to
            </Chip>
          )}
          {tally.empty.length > 0 && (
            <Chip tone="neutral" className="h-[38px] px-3.5 text-sm">
              {tally.empty.length} not answered
            </Chip>
          )}
        </div>
      </div>

      <ul className="grid grid-cols-4 gap-4">
        {questions.map((q, i) => {
          const status = statusOf(q, answers);
          const meta = KIND_META[q.kind];
          const c = chip[status];
          return (
            <li key={q.id} className="contents">
              <button
                type="button"
                onClick={() => onGo(i)}
                className={cn(
                  "flex min-h-[170px] flex-col items-stretch gap-2.5 rounded-3xl p-[18px] text-left transition hover:-translate-y-0.5 hover:shadow-md",
                  card[status],
                )}
              >
                <span className="flex items-center justify-between">
                  <span className={cn("flex h-[34px] items-center rounded-xl px-3 text-[15px] font-black", meta.bg, meta.fg)}>
                    Q{q.position}
                  </span>
                  <Chip tone={c.tone}>{c.label}</Chip>
                </span>
                <span className="text-[13px] font-extrabold text-muted">
                  {meta.label} · {plural(q.points, "mark")}
                </span>
                <span className="line-clamp-3 text-[15px] font-bold leading-[1.4]">{q.prompt.replace(/_{3,}/g, "____")}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[26px] border border-line bg-white px-[22px] py-[18px]">
        <p className="text-[15px] font-bold text-ink-2">You can still change any answer until you submit.</p>
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={onBack} size="md" className="h-[52px]">
            Keep working
          </Button>
          <Button onClick={onSubmit} className="h-[52px] px-[26px]">
            Submit exam
          </Button>
        </div>
      </div>
    </div>
  );
}
