"use client";

import type { StudentQuestion } from "@/lib/api-types";
import { KIND_META } from "@/lib/question-kinds";
import { cn, formatClock } from "@/lib/utils";
import { statusOf, type Answers, type QuestionStatus, type Tally } from "@/components/student/exam/examStatus";
import { Button, Card, Chip, Modal } from "@/components/ui";

const statusWord: Record<QuestionStatus, string> = {
  answered: "answered",
  flagged: "marked to come back later",
  empty: "not answered yet",
};

const statusChip: Record<QuestionStatus, { label: string; tone: "brand" | "amber" | "neutral" }> = {
  answered: { label: "Answered", tone: "brand" },
  flagged: { label: "Come back", tone: "amber" },
  empty: { label: "Not yet", tone: "neutral" },
};

function CountChips({ tally }: { tally: Tally }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone="brand" size="lg">
        {tally.answered} answered
      </Chip>
      {tally.flagged.length > 0 && (
        <Chip tone="amber" size="lg">
          {tally.flagged.length} to come back to
        </Chip>
      )}
      {tally.empty.length > 0 && (
        <Chip tone="neutral" size="lg">
          {tally.empty.length} not answered
        </Chip>
      )}
    </div>
  );
}

interface CommonProps {
  questions: StudentQuestion[];
  answers: Answers;
  currentId: number;
  tally: Tally;
  onGo: (index: number) => void;
}

/** Desktop sidebar: a grid of numbered buttons showing progress at a glance. */
export function QuestionGrid({ questions, answers, currentId, tally, onGo, onReview }: CommonProps & { onReview: () => void }) {
  return (
    <Card className="sticky top-[96px] flex flex-col gap-4 rounded-[26px] p-5">
      <h2 className="text-lg font-black">Your questions</h2>
      <nav aria-label="Questions" className="grid grid-cols-4 gap-2.5">
        {questions.map((q, i) => {
          const status = statusOf(q, answers);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onGo(i)}
              aria-label={`Question ${q.position}, ${statusWord[status]}`}
              aria-current={q.id === currentId ? "step" : undefined}
              className={cn(
                "grid h-12 place-items-center rounded-2xl text-[15px] font-black transition active:scale-95",
                status === "answered" && "bg-brand text-white hover:bg-brand-dark",
                status === "flagged" && "bg-amber text-amber-ink shadow-[inset_0_0_0_2px_var(--color-amber-line)]",
                status === "empty" && "bg-chip text-ink hover:bg-line",
                q.id === currentId && "outline-[2.5px] outline-offset-2 outline-ink",
              )}
            >
              {q.position}
            </button>
          );
        })}
      </nav>
      <ul className="flex flex-col gap-1.5 text-[13px] font-bold text-muted" aria-label="Legend">
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-brand" /> Answered
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-amber-line" /> Marked to come back to
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-[#e2ddd3]" /> Not answered yet
        </li>
      </ul>
      <CountChips tally={tally} />
      <Button onClick={onReview} block>
        Review and submit
      </Button>
    </Card>
  );
}

/** Phone bottom sheet: the same information as a tappable list. */
export function QuestionSheet({
  open,
  mode,
  onClose,
  questions,
  answers,
  currentId,
  tally,
  remainingSec,
  onGo,
  onSubmit,
}: CommonProps & {
  open: boolean;
  /** "list" opens from the header; "review" opens after the last question. */
  mode: "list" | "review";
  onClose: () => void;
  remainingSec: number;
  onSubmit: () => void;
}) {
  const review = mode === "review";
  return (
    <Modal open={open} onClose={onClose} variant="sheet" labelledBy="sheet-title">
      <div className="flex flex-col gap-3.5 px-[18px] pb-6 pt-3">
        <span aria-hidden className="h-[5px] w-11 self-center rounded-full bg-[#ddd7cd]" />
        <div className="flex items-center justify-between gap-3">
          <h2 id="sheet-title" tabIndex={-1} data-autofocus className="text-[22px] font-black outline-none">
            {review ? "Ready to hand it in?" : "Your questions"}
          </h2>
          <span className="flex h-9 items-center rounded-full bg-brand-tint px-3 text-base font-black tabular-nums text-brand-dark">
            {formatClock(remainingSec)} left
          </span>
        </div>
        {review ? (
          <p className="text-sm font-bold text-muted">Tap a question to go back to it.</p>
        ) : (
          <CountChips tally={tally} />
        )}

        <nav aria-label="Questions" className="flex flex-col gap-1.5">
          {questions.map((q, i) => {
            const status = statusOf(q, answers);
            const meta = KIND_META[q.kind];
            const chip = statusChip[status];
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onGo(i)}
                aria-current={q.id === currentId ? "step" : undefined}
                className={cn(
                  "flex min-h-12 items-center gap-3 rounded-2xl border border-line py-1.5 pl-1.5 pr-2.5 text-left transition active:scale-[0.99]",
                  q.id === currentId ? "bg-paper shadow-[inset_0_0_0_2px_var(--color-ink)]" : "bg-white",
                )}
              >
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl font-black", meta.bg, meta.fg)}>
                  {q.position}
                </span>
                <span className="flex-1 text-[15px] font-extrabold">{meta.label}</span>
                <span className="sr-only">{statusWord[status]}</span>
                <Chip tone={chip.tone} aria-hidden>
                  {chip.label}
                </Chip>
              </button>
            );
          })}
        </nav>

        <div className="grid grid-cols-3 gap-2.5">
          <Button variant="secondary" onClick={onClose} size="md" className="h-[52px]">
            Back
          </Button>
          <Button onClick={onSubmit} className="col-span-2 h-[52px]">
            {review ? "Submit exam" : "Review and submit"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
