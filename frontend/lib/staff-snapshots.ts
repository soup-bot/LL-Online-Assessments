import type { EditorQuestion, ExamBuilder, QuestionDraft } from "@/lib/staff-types";
import type { QuestionKind } from "@/lib/types";

/**
 * The last exam the builder loaded, kept in memory. Moving between the exam page and the question editor then
 * shows something straight away while the fresh copy loads quietly, instead of an empty skeleton each time.
 * It lives only in this tab's memory and is dropped on sign-out, so nothing is shown to the wrong person.
 */
const builders = new Map<number, ExamBuilder>();

export const rememberBuilder = (b: ExamBuilder) => void builders.set(b.id, b);
export const recallBuilder = (id: number) => builders.get(id) ?? null;
export const forgetBuilder = (id: number) => void builders.delete(id);
export const forgetSnapshots = () => builders.clear();

/** A blank question of `kind`, the same defaults the server hands out. */
export function blankDraft(kind: QuestionKind): QuestionDraft {
  return {
    kind,
    prompt: kind === "fill_blank" ? "Type the sentence and put ________ where the blank goes." : "",
    points: kind === "written" ? 4 : 1,
    options: ["", "", "", ""],
    correct: "",
    trueFalse: null,
    accepted: [],
    markingPoints: [],
    approved: false,
  };
}

/** The editor's starting point for a new question, when the exam is already known. Otherwise null (fetch it). */
export function newQuestionFrom(examId: number, kind: QuestionKind): EditorQuestion | null {
  const exam = recallBuilder(examId);
  if (!exam) return null;
  const next = exam.questions.length + 1;
  return { id: null, position: next, total: next, examTitle: exam.title, locked: !exam.canEdit, draft: blankDraft(kind) };
}
