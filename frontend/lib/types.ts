/**
 * Domain types. They mirror the tables the Laravel API will own, so the mock
 * store and the real backend can share one vocabulary.
 * All timestamps are ISO-8601 strings.
 */

export type Role = "admin" | "tutor" | "student";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  /** Optional teacher title ("Ms", "Mr") used in student-facing copy. */
  honorific?: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  subjectCode: string;
  grade: number;
  tutorId: number;
  studentIds: number[];
}

export type QuestionKind = "mcq" | "true_false" | "fill_blank" | "written";

export interface Option {
  key: string;
  text: string;
}

export type AnswerKey =
  | { kind: "mcq"; correct: string }
  | { kind: "true_false"; correct: boolean | null }
  | { kind: "fill_blank"; accepted: string[] }
  | { kind: "written"; markingPoints: string[] };

/** Full question, including the answer key. Never sent to a student while sitting. */
export interface Question {
  id: number;
  examId: number;
  position: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  options?: Option[];
  answerKey: AnswerKey;
  approved: boolean;
}

export type ExamStatus = "draft" | "published";

/** "in_order": everyone sees the teacher's order. "random": each student gets their own order. */
export type QuestionOrder = "in_order" | "random";

export interface Exam {
  id: number;
  title: string;
  ownerId: number;
  timeLimitMinutes: number;
  questionOrder: QuestionOrder;
  rules: string;
  status: ExamStatus;
  publishedAt: string | null;
}

export type SessionStatus = "not_open" | "open" | "closed";

/** One exam opened for one class. */
export interface ExamSession {
  id: number;
  examId: number;
  classId: number;
  status: SessionStatus;
  openedAt: string | null;
  closedAt: string | null;
  resultsReleasedAt: string | null;
}

export type AttemptStatus = "in_progress" | "submitted" | "marked";
export type SubmitReason = "manual" | "timeout" | "violations" | "closed";

export interface Attempt {
  id: number;
  sessionId: number;
  studentId: number;
  startedAt: string;
  /** startedAt + time limit, fixed on the server when the attempt starts. */
  deadlineAt: string;
  submittedAt: string | null;
  submitReason: SubmitReason | null;
  status: AttemptStatus;
  violationCount: number;
  overallComment: string | null;
  resultViewedAt: string | null;
}

export interface AnswerRecord {
  attemptId: number;
  questionId: number;
  /** mcq: option key. true_false: "true" | "false". fill_blank / written: free text. */
  response: string | null;
  flagged: boolean;
  /** null while a written answer is still waiting for the teacher. */
  awardedMarks: number | null;
  feedback: string | null;
  /** Written answers: which marking points the teacher ticked. */
  ticks?: number[];
}

export interface ViolationRecord {
  attemptId: number;
  at: string;
  kind: "hidden" | "blur";
}

export interface DbState {
  version: number;
  users: User[];
  classes: SchoolClass[];
  exams: Exam[];
  questions: Question[];
  sessions: ExamSession[];
  attempts: Attempt[];
  answers: AnswerRecord[];
  violations: ViolationRecord[];
  nextAttemptId: number;
}
