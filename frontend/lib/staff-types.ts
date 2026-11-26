import type { Grade } from "@/lib/grading";
import type { AttemptStatus, ExamStatus, Navigation, QuestionKind, SessionStatus, SubmitReason } from "@/lib/types";

/** Shapes the teacher and admin screens consume. The Laravel resources will return the same JSON. */

export interface StaffProfile {
  id: number;
  name: string;
  initials: string;
  email: string;
  role: "tutor" | "admin";
}

export interface PersonLite {
  id: number;
  name: string;
  initials: string;
}

/* ------------------------------------------------------------ teacher: exams */

export interface ClassChip {
  sessionId: number;
  classId: number;
  /** "Batch A" */
  label: string;
  status: SessionStatus;
  released: boolean;
}

/** Where an exam is in its life, which decides the card's wording and button. */
export type ExamStage = "draft" | "ready" | "live" | "marking" | "released";

export interface TutorExamRow {
  id: number;
  title: string;
  status: ExamStatus;
  stage: ExamStage;
  timeLimitMinutes: number;
  questionCount: number;
  totalMarks: number;
  approvedCount: number;
  classes: ClassChip[];
  submitted: number;
  studentTotal: number;
  toMark: number;
  averagePercent: number | null;
  releasedAt: string | null;
}

export interface TutorHome {
  tutor: StaffProfile;
  stats: { open: number; toMark: number; drafts: number };
  exams: TutorExamRow[];
}

export interface BuilderQuestion {
  id: number;
  position: number;
  kind: QuestionKind;
  prompt: string;
  points: number;
  approved: boolean;
}

export interface ExamBuilder {
  id: number;
  title: string;
  status: ExamStatus;
  timeLimitMinutes: number;
  navigation: Navigation;
  rules: string;
  questions: BuilderQuestion[];
  totalMarks: number;
  approvedCount: number;
  classes: { classId: number; name: string; linked: boolean; sessionStatus: SessionStatus | null }[];
  /** Why Publish is disabled, or null when it is allowed. */
  publishBlocker: string | null;
  /** Draft exams owned by the signed-in teacher can be edited. */
  canEdit: boolean;
}

export interface ExamSettingsPatch {
  title?: string;
  timeLimitMinutes?: number;
  navigation?: Navigation;
  rules?: string;
  classIds?: number[];
}

/** What the question editor reads and writes. Option and answer fields depend on `kind`. */
export interface QuestionDraft {
  kind: QuestionKind;
  prompt: string;
  points: number;
  /** mcq: the four option texts, in A–D order. */
  options: string[];
  /** mcq: "A"–"D", or "" when not chosen. */
  correct: string;
  /** true_false: null until chosen. */
  trueFalse: boolean | null;
  /** fill_blank: every accepted answer. */
  accepted: string[];
  /** written: the marking checklist. */
  markingPoints: string[];
  approved: boolean;
}

export interface EditorQuestion {
  /** Absent while creating a new question. */
  id: number | null;
  position: number;
  total: number;
  examTitle: string;
  locked: boolean;
  draft: QuestionDraft;
}

/* ----------------------------------------------------- teacher: classes + live */

export interface ClassCard {
  sessionId: number;
  classId: number;
  name: string;
  label: string;
  status: SessionStatus;
  openedAt: string | null;
  closedAt: string | null;
  releasedAt: string | null;
  students: number;
  sitting: number;
  handedIn: number;
  toMark: number;
  notStarted: number;
}

export interface ExamSessions {
  exam: { id: number; title: string; status: ExamStatus; questionCount: number; totalMarks: number };
  canEdit: boolean;
  classes: ClassCard[];
}

export type LiveState = "not_started" | "sitting" | "to_mark" | "marked" | "not_attempted";

export interface LiveRow {
  studentId: number;
  name: string;
  initials: string;
  attemptId: number | null;
  state: LiveState;
  detail: string;
  answered: number;
  questionCount: number;
  violations: number;
  /** Seconds left while sitting. */
  secondsLeft: number | null;
  scoreText: string;
  grade: Grade | null;
}

export interface LiveData {
  card: ClassCard;
  rows: LiveRow[];
  questionCount: number;
  release: { closed: boolean; toMark: number; canRelease: boolean; released: boolean };
}

export interface ToMarkItem {
  attemptId: number;
  student: PersonLite;
  examTitle: string;
  className: string;
  submittedAt: string;
  writtenCount: number;
}

export interface TeacherClass {
  id: number;
  name: string;
  subjectCode: string;
  grade: number;
  students: PersonLite[];
  exams: { examId: number; sessionId: number; title: string; status: SessionStatus; released: boolean }[];
}

/* -------------------------------------------------------------- teacher: marking */

export interface MarkingObjective {
  position: number;
  kind: QuestionKind;
  answer: string;
  awarded: number;
  points: number;
}

export interface MarkingWritten {
  questionId: number;
  position: number;
  points: number;
  prompt: string;
  answer: string | null;
  markingPoints: string[];
  ticks: number[];
  /** null until the teacher has marked it. */
  awarded: number | null;
  feedback: string;
}

export interface MarkingData {
  attemptId: number;
  examId: number;
  sessionId: number;
  examTitle: string;
  className: string;
  student: PersonLite;
  firstName: string;
  submittedAt: string | null;
  submitReason: SubmitReason | null;
  answered: number;
  questionCount: number;
  status: AttemptStatus;
  released: boolean;
  canEdit: boolean;
  violations: { at: string; kind: "hidden" | "blur" }[];
  objective: MarkingObjective[];
  objectiveScore: number;
  objectiveTotal: number;
  written: MarkingWritten[];
  overallComment: string;
  totalMarks: number;
}

export interface SaveMarksInput {
  answers: { questionId: number; awarded: number; feedback: string; ticks: number[] }[];
  overallComment: string;
}

/** The JSON shape the "import with AI" prompt asks the assistant to return. */
export interface ImportedExam {
  title?: string;
  time_limit_minutes?: number;
  rules?: string;
  questions: {
    type: string;
    prompt?: string;
    points?: number;
    options?: string[];
    answer?: string | boolean | null;
    accepted_answers?: string[];
    marking_points?: string[];
  }[];
}

/* -------------------------------------------------------------------- admin */

export type UserRole = "tutor" | "student" | "admin";

export interface UserRow extends PersonLite {
  email: string;
  role: UserRole;
  classes: string;
}

export interface UsersData {
  users: UserRow[];
  counts: { tutors: number; students: number; admins: number };
}

export interface UserInput {
  name: string;
  email: string;
  role: UserRole;
}

export interface AdminClass {
  id: number;
  name: string;
  subjectCode: string;
  grade: number;
  tutorId: number;
  students: PersonLite[];
}

export interface AdminClassesData {
  classes: AdminClass[];
  tutors: PersonLite[];
  /** Every student, with the class they sit in now (if any). */
  students: (PersonLite & { className: string | null })[];
}

export interface ClassInput {
  name: string;
  subjectCode: string;
  grade: number;
  tutorId: number;
  studentIds: number[];
}

export type AdminExamStatus = "not_open" | "open" | "closed" | "released";

export interface AdminExamRow {
  sessionId: number;
  examId: number;
  title: string;
  teacher: string;
  teacherId: number;
  classId: number;
  className: string;
  status: AdminExamStatus;
  handedIn: number;
  students: number;
  marked: number;
  averageText: string;
}

export interface AdminExamsData {
  rows: AdminExamRow[];
  teachers: PersonLite[];
  classes: { id: number; label: string }[];
}
