import type { Grade } from "@/lib/grading";
import type { AttemptStatus, QuestionKind, SubmitReason } from "@/lib/types";

/** Shapes the student screens consume. The Laravel resources will return the same JSON. */

export interface StudentProfile {
  id: number;
  name: string;
  firstName: string;
  initials: string;
  className: string;
}

export interface ExamCard {
  sessionId: number;
  title: string;
  subjectCode: string;
  subjectName: string;
  teacher: string;
  timeLimitMinutes: number;
  questionCount: number;
  totalMarks: number;
  kindCounts: Record<QuestionKind, number>;
  /** Set when the student has already started this exam. */
  attemptId?: number;
  deadlineAt?: string;
}

export interface ResultSummary {
  attemptId: number;
  title: string;
  subjectCode: string;
  subjectName: string;
  score: number;
  total: number;
  percent: number;
  grade: Grade;
  releasedAt: string;
  isNew: boolean;
}

export interface StudentHome {
  student: StudentProfile;
  serverNow: string;
  open: ExamCard[];
  inProgress: ExamCard[];
  newResults: ResultSummary[];
}

export interface CoverData {
  sessionId: number;
  title: string;
  subjectCode: string;
  subjectName: string;
  className: string;
  teacher: string;
  timeLimitMinutes: number;
  questionCount: number;
  totalMarks: number;
  /** Students may move between questions in any order. */
  freeNavigation: boolean;
  globalRules: { id: string; text: string }[];
  examRules: string;
  student: StudentProfile;
  /** Already started: go straight back into it. */
  resumeAttemptId?: number;
}

export interface StudentQuestion {
  id: number;
  position: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  options?: { key: string; text: string }[];
}

export interface SavedAnswer {
  response: string | null;
  flagged: boolean;
}

export interface AttemptState {
  attemptId: number;
  sessionId: number;
  title: string;
  subtitle: string;
  status: AttemptStatus;
  serverNow: string;
  deadlineAt: string;
  violationCount: number;
  maxViolations: number;
  questions: StudentQuestion[];
  answers: Record<number, SavedAnswer>;
  student: StudentProfile;
}

export interface SaveAnswerPatch {
  response?: string | null;
  flagged?: boolean;
}

export interface SyncInfo {
  serverNow: string;
  deadlineAt: string;
}

export interface ViolationOutcome {
  count: number;
  max: number;
  autoSubmitted: boolean;
}

export interface SubmittedSummary {
  attemptId: number;
  title: string;
  student: StudentProfile;
  teacher: string;
  submittedAt: string;
  reason: SubmitReason;
  answered: number;
  questionCount: number;
  /** Written answers still waiting for the teacher. */
  awaitingMarking: boolean;
  status: AttemptStatus;
  resultsReleased: boolean;
}

export type ResultListItem =
  | {
      kind: "released";
      attemptId: number;
      title: string;
      score: number;
      total: number;
      percent: number;
      grade: Grade;
      releasedAt: string;
      isNew: boolean;
      /** Grade of the previous released exam in the same subject. */
      previousGrade?: Grade;
    }
  | {
      kind: "pending";
      attemptId: number;
      title: string;
      submittedAt: string;
      /** "marking": the teacher is still marking. "release": marked, waiting to be released. */
      stage: "marking" | "release";
    };

export interface SubjectResults {
  subjectCode: string;
  subjectName: string;
  subjectShort: string;
  items: ResultListItem[];
}

export interface StudentResults {
  student: StudentProfile;
  subjects: SubjectResults[];
  releasedCount: number;
  pendingCount: number;
  latest: { subjectShort: string; title: string; grade: Grade; percent: number } | null;
}

export interface ResultQuestion {
  position: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  awarded: number;
  /** Plain-text version of the student's answer, or null when left blank. */
  yourAnswer: string | null;
  /** Shown only after release. */
  correctAnswer: string | null;
  feedback: string | null;
}

export interface ResultDetail {
  attemptId: number;
  title: string;
  subjectName: string;
  teacher: string;
  teacherInitials: string;
  score: number;
  total: number;
  percent: number;
  grade: Grade;
  overallComment: string | null;
  releasedAt: string;
  questions: ResultQuestion[];
  student: StudentProfile;
}
