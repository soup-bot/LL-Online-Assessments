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
