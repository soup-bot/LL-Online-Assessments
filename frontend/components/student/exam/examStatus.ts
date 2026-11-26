import type { StudentQuestion } from "@/lib/api-types";
import { hasAnswer } from "@/lib/grading";

export interface LocalAnswer {
  response: string | null;
  flagged: boolean;
}

export type Answers = Record<number, LocalAnswer>;

/** What a question looks like in the navigator: a flag wins over an answer. */
export type QuestionStatus = "answered" | "flagged" | "empty";

export function isAnswered(question: StudentQuestion, answers: Answers): boolean {
  return hasAnswer(question.kind, answers[question.id]?.response);
}

export function statusOf(question: StudentQuestion, answers: Answers): QuestionStatus {
  if (answers[question.id]?.flagged) return "flagged";
  return isAnswered(question, answers) ? "answered" : "empty";
}

export function tally(questions: StudentQuestion[], answers: Answers) {
  const answered = questions.filter((q) => isAnswered(q, answers));
  const flagged = questions.filter((q) => answers[q.id]?.flagged);
  const empty = questions.filter((q) => !isAnswered(q, answers));
  return {
    answered: answered.length,
    flagged: flagged.map((q) => q.position),
    empty: empty.map((q) => q.position),
    total: questions.length,
  };
}

export type Tally = ReturnType<typeof tally>;

/** Chip colours shared by the phone strip and the desktop grid: answered is light purple. */
export const chipTone: Record<QuestionStatus, string> = {
  answered: "bg-lilac text-lilac-ink",
  flagged: "bg-amber text-amber-ink",
  empty: "bg-chip text-ink-2",
};

/** The question you are on: solid purple with the brand squiggle. */
// A bolder copy of the squiggle (public/squiggly-chip.svg): the standard one vanishes at chip size.
export const currentChip =
  "relative z-10 bg-lilac-ink bg-[url('/squiggly-chip.svg')] bg-size-[150px_auto] bg-center text-white";
