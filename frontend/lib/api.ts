/**
 * The only module the screens talk to. Today it runs against the browser-side mock
 * store; when the Laravel API exists, each function becomes a fetch() with the same
 * input and output, and nothing else in the app changes.
 */

import type {
  AttemptState,
  ClockInfo,
  CoverData,
  ExamCard,
  ResultDetail,
  ResultListItem,
  ResultSummary,
  SaveAnswerPatch,
  StudentHome,
  StudentProfile,
  StudentResults,
  SubjectResults,
  SubmittedSummary,
  SyncInfo,
  ViolationOutcome,
} from "@/lib/api-types";
import { realAuth, realStudent } from "@/lib/api-real";
import { GLOBAL_RULES, MAX_VIOLATIONS, SAVE_GRACE_MS } from "@/lib/config";
import { USE_MOCK } from "@/lib/env";
import { request } from "@/lib/http";
import { gradeFor, hasAnswer, markObjective, percentOf } from "@/lib/grading";
import {
  isSimulatingOffline,
  isViolationGuardDisabled,
  mutate,
  readDb,
  resetDb,
  sessionUserId,
  setSessionUserId,
  setSimulatingOffline,
  setViolationGuardDisabled,
} from "@/lib/mock/db";
import { PASSWORD } from "@/lib/mock/seed";
import type {
  AnswerRecord,
  Attempt,
  DbState,
  Exam,
  ExamSession,
  Question,
  SchoolClass,
  SubmitReason,
  User,
} from "@/lib/types";
import { firstName, initials, subjectShort, subjectTitle, teacherLabel } from "@/lib/utils";

/* ------------------------------------------------------------------ errors */

// Defined in their own module so the real HTTP client can use them too; re-exported for the screens.
export { ApiError, toApiError, UNAUTHORIZED_EVENT, type ApiErrorCode } from "@/lib/api-error";
import { ApiError, UNAUTHORIZED_EVENT } from "@/lib/api-error";

/* --------------------------------------------------------------- plumbing */

/** Simulated round trip: a little latency, and the dev "offline" switch. */
export async function call<T>(fn: () => T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 120 + Math.random() * 180));
  if (isSimulatingOffline()) {
    throw new ApiError("network", "We can't reach the server. Check your connection and try again.");
  }
  try {
    return fn();
  } catch (e) {
    // Any call that finds the session gone tells the app, which signs out and shows the login page.
    if (e instanceof ApiError && e.code === "unauthorized") window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw e;
  }
}

export const nowIso = () => new Date().toISOString();

function currentStudent(db: DbState): User {
  const user = db.users.find((u) => u.id === sessionUserId());
  if (!user) throw new ApiError("unauthorized", "Your session has ended. Please sign in again.");
  if (user.role !== "student") throw new ApiError("forbidden", "This area is for students.");
  return user;
}

/** Every class a student sits in. A student can take several subjects, one class per subject. */
function classesOf(db: DbState, studentId: number): SchoolClass[] {
  return db.classes.filter((c) => c.studentIds.includes(studentId));
}

export function profileOf(db: DbState, user: User): StudentProfile {
  const classes = classesOf(db, user.id);
  // One class: its full name. Several: "Economics (Batch A) · Business Studies (Batch C)".
  const className =
    classes.length <= 1
      ? (classes[0]?.name ?? "")
      : classes.map((c) => `${subjectShort(c)} (${c.name.split(",")[1]?.trim() ?? c.name})`).join(" · ");
  return {
    id: user.id,
    name: user.name,
    firstName: firstName(user.name),
    initials: initials(user.name),
    className,
    classes: classes.map((c) => ({
      id: c.id,
      name: c.name,
      subjectCode: c.subjectCode,
      subjectName: subjectTitle(c),
      subjectShort: subjectShort(c),
      batch: c.name.split(",")[1]?.trim() ?? c.name,
    })),
  };
}

export const examOf = (db: DbState, session: ExamSession): Exam => db.exams.find((e) => e.id === session.examId)!;
export const sessionOf = (db: DbState, attempt: Attempt): ExamSession => db.sessions.find((s) => s.id === attempt.sessionId)!;
export const questionsOf = (db: DbState, examId: number): Question[] =>
  db.questions.filter((q) => q.examId === examId).sort((a, b) => a.position - b.position);
const teacherOfExam = (db: DbState, exam: Exam) => teacherLabel(db.users.find((u) => u.id === exam.ownerId));
export const answersOf = (db: DbState, attemptId: number) => db.answers.filter((a) => a.attemptId === attemptId);

function ownedAttempt(db: DbState, attemptId: number, user: User): Attempt {
  const attempt = db.attempts.find((a) => a.id === attemptId && a.studentId === user.id);
  if (!attempt) throw new ApiError("not_found", "We couldn't find that exam.");
  return attempt;
}

/** A session this student may see: their class, published exam. */
function visibleSession(db: DbState, user: User, sessionId: number): ExamSession {
  const session = db.sessions.find((s) => s.id === sessionId);
  const cls = session && db.classes.find((c) => c.id === session.classId);
  const exam = session && examOf(db, session);
  if (!session || !cls || !exam || !cls.studentIds.includes(user.id) || exam.status !== "published") {
    throw new ApiError("not_found", "We couldn't find that exam.");
  }
  return session;
}

function kindCounts(questions: Question[]) {
  const counts = { mcq: 0, true_false: 0, fill_blank: 0, written: 0 };
  for (const q of questions) counts[q.kind] += 1;
  return counts;
}

export function totalMarks(questions: Question[]) {
  return questions.reduce((sum, q) => sum + q.points, 0);
}

/* ------------------------------------------------------- attempt lifecycle */

/** Submit an attempt: mark the objective questions and decide if the teacher is needed. */
export function finalize(db: DbState, attempt: Attempt, reason: SubmitReason, at: Date = new Date()): void {
  if (attempt.status !== "in_progress") return;
  const session = sessionOf(db, attempt);
  let needsTeacher = false;

  for (const question of questionsOf(db, session.examId)) {
    let record = db.answers.find((a) => a.attemptId === attempt.id && a.questionId === question.id);
    if (!record) {
      record = { attemptId: attempt.id, questionId: question.id, response: null, flagged: false, awardedMarks: null, feedback: null };
      db.answers.push(record);
    }
    const auto = markObjective(question, record.response);
    if (auto !== null) {
      record.awardedMarks = auto;
    } else if (!hasAnswer("written", record.response)) {
      record.awardedMarks = 0; // a blank written answer leaves nothing to mark
    } else {
      record.awardedMarks = null;
      needsTeacher = true;
    }
  }

  attempt.submittedAt = at.toISOString();
  attempt.submitReason = reason;
  attempt.status = needsTeacher ? "submitted" : "marked";
}

/** Server-side clock check: an attempt past its deadline (plus grace) is submitted for the student. */
export function expireIfDue(db: DbState, attempt: Attempt): boolean {
  if (attempt.status === "in_progress" && Date.now() > Date.parse(attempt.deadlineAt) + SAVE_GRACE_MS) {
    finalize(db, attempt, "timeout", new Date(attempt.deadlineAt));
    return true;
  }
  return false;
}

export function score(db: DbState, attempt: Attempt) {
  const questions = questionsOf(db, sessionOf(db, attempt).examId);
  const records = answersOf(db, attempt.id);
  const got = records.reduce((sum, r) => sum + (r.awardedMarks ?? 0), 0);
  return { score: got, total: totalMarks(questions) };
}

export const isReleased = (db: DbState, attempt: Attempt) =>
  attempt.status === "marked" && sessionOf(db, attempt).resultsReleasedAt != null;

function examCard(db: DbState, session: ExamSession, attempt?: Attempt): ExamCard {
  const exam = examOf(db, session);
  const cls = db.classes.find((c) => c.id === session.classId)!;
  const questions = questionsOf(db, exam.id);
  return {
    sessionId: session.id,
    title: exam.title,
    subjectCode: cls.subjectCode,
    subjectName: subjectTitle(cls),
    teacher: teacherOfExam(db, exam),
    timeLimitMinutes: exam.timeLimitMinutes,
    questionCount: questions.length,
    totalMarks: totalMarks(questions),
    kindCounts: kindCounts(questions),
    attemptId: attempt?.id,
    deadlineAt: attempt?.deadlineAt,
  };
}

function summarise(db: DbState, attempt: Attempt): ResultSummary {
  const session = sessionOf(db, attempt);
  const cls = db.classes.find((c) => c.id === session.classId)!;
  const { score: got, total } = score(db, attempt);
  return {
    attemptId: attempt.id,
    title: examOf(db, session).title,
    subjectCode: cls.subjectCode,
    subjectName: subjectTitle(cls),
    score: got,
    total,
    percent: percentOf(got, total),
    grade: gradeFor(got, total),
    releasedAt: session.resultsReleasedAt!,
    isNew: attempt.resultViewedAt == null,
  };
}

function attemptState(db: DbState, attempt: Attempt, user: User): AttemptState {
  const session = sessionOf(db, attempt);
  const exam = examOf(db, session);
  const cls = db.classes.find((c) => c.id === session.classId)!;
  const batch = cls.name.split(",")[1]?.trim();
  const answers: AttemptState["answers"] = {};
  for (const r of answersOf(db, attempt.id)) answers[r.questionId] = { response: r.response, flagged: r.flagged };

  return {
    attemptId: attempt.id,
    sessionId: session.id,
    title: exam.title,
    subtitle: [`${subjectShort(cls)} ${cls.subjectCode}`, batch].filter(Boolean).join(" · "),
    status: attempt.status,
    serverNow: nowIso(),
    deadlineAt: attempt.deadlineAt,
    violationCount: attempt.violationCount,
    maxViolations: MAX_VIOLATIONS,
    // Strip the answer key: only what a student may see while sitting.
    questions: questionsOf(db, exam.id).map((q) => ({
      id: q.id,
      position: q.position,
      kind: q.kind,
      prompt: q.prompt,
      points: q.points,
      options: q.options,
    })),
    answers,
    student: profileOf(db, user),
  };
}

/* ------------------------------------------------------------ text helpers */

function optionText(q: Question, key: string | null): string | null {
  if (key == null) return null;
  const option = q.options?.find((o) => o.key === key);
  return option ? `${option.key}. ${option.text}` : key;
}

function yourAnswerText(q: Question, response: string | null): string | null {
  if (!hasAnswer(q.kind, response)) return null;
  if (q.kind === "mcq") return optionText(q, response);
  if (q.kind === "true_false") return response === "true" ? "True" : "False";
  return (response ?? "").trim();
}

function correctAnswerText(q: Question): string | null {
  const key = q.answerKey;
  switch (key.kind) {
    case "mcq":
      return optionText(q, key.correct);
    case "true_false":
      return key.correct == null ? null : key.correct ? "True" : "False";
    case "fill_blank":
      return key.accepted.join(", ");
    case "written":
      return null;
  }
}

/* --------------------------------------------------------------------- API */

/** Who is signed in when the app opens: the demo data's choice, or whoever the session cookie belongs to (asked of the server). */
export async function restoreUser(): Promise<User | null> {
  if (!USE_MOCK) return realAuth.me();
  const id = sessionUserId();
  return id == null ? null : (readDb().users.find((u) => u.id === id) ?? null);
}

const mockApi = {
  auth: {
    async login(email: string, password: string): Promise<User> {
      return call(() => {
        const user = readDb().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user || password !== PASSWORD) // "validation", not "unauthorized": a wrong password must not look like an expired session
        throw new ApiError("validation", "That email and password don't match. Please try again.");
        setSessionUserId(user.id);
        return user;
      });
    },
    logout(): void {
      setSessionUserId(null);
    },
  },

  student: {
    async home(): Promise<StudentHome> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const myClassIds = db.classes.filter((c) => c.studentIds.includes(user.id)).map((c) => c.id);
          const open: ExamCard[] = [];
          const inProgress: ExamCard[] = [];

          for (const session of db.sessions) {
            if (!myClassIds.includes(session.classId) || session.status !== "open") continue;
            if (examOf(db, session).status !== "published") continue;
            const attempt = db.attempts.find((a) => a.sessionId === session.id && a.studentId === user.id);
            if (attempt) expireIfDue(db, attempt);
            if (!attempt) open.push(examCard(db, session));
            else if (attempt.status === "in_progress") inProgress.push(examCard(db, session, attempt));
          }

          const newResults = db.attempts
            .filter((a) => a.studentId === user.id && isReleased(db, a) && a.resultViewedAt == null)
            .map((a) => summarise(db, a))
            .sort((x, y) => y.releasedAt.localeCompare(x.releasedAt));

          return { student: profileOf(db, user), serverNow: nowIso(), open, inProgress, newResults };
        }),
      );
    },

    async cover(sessionId: number): Promise<CoverData> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const session = visibleSession(db, user, sessionId);
          const exam = examOf(db, session);
          const cls = db.classes.find((c) => c.id === session.classId)!;
          const attempt = db.attempts.find((a) => a.sessionId === session.id && a.studentId === user.id);
          if (attempt) expireIfDue(db, attempt);

          if (attempt && attempt.status !== "in_progress") {
            throw new ApiError("conflict", "You've already handed this exam in.");
          }
          if (!attempt && session.status !== "open") {
            throw new ApiError("not_found", "This exam isn't open right now.");
          }

          const questions = questionsOf(db, exam.id);
          return {
            sessionId: session.id,
            title: exam.title,
            subjectCode: cls.subjectCode,
            subjectName: subjectTitle(cls),
            className: cls.name,
            teacher: teacherOfExam(db, exam),
            timeLimitMinutes: exam.timeLimitMinutes,
            questionCount: questions.length,
            totalMarks: totalMarks(questions),
            freeNavigation: exam.navigation !== "in_order",
            globalRules: GLOBAL_RULES.map((r) => ({ id: r.id, text: r.text })),
            examRules: exam.rules,
            student: profileOf(db, user),
            resumeAttemptId: attempt?.id,
          };
        }),
      );
    },

    /** Starts the timer. Safe to call twice: a second call returns the same attempt. */
    async start(sessionId: number): Promise<{ attemptId: number }> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const session = visibleSession(db, user, sessionId);
          const existing = db.attempts.find((a) => a.sessionId === session.id && a.studentId === user.id);
          if (existing) {
            expireIfDue(db, existing);
            if (existing.status !== "in_progress") throw new ApiError("conflict", "You've already handed this exam in.");
            return { attemptId: existing.id };
          }
          if (session.status !== "open") throw new ApiError("not_found", "This exam isn't open right now.");

          const exam = examOf(db, session);
          const startedAt = new Date();
          const attempt: Attempt = {
            id: db.nextAttemptId++,
            sessionId: session.id,
            studentId: user.id,
            startedAt: startedAt.toISOString(),
            deadlineAt: new Date(startedAt.getTime() + exam.timeLimitMinutes * 60 * 1000).toISOString(),
            submittedAt: null,
            submitReason: null,
            status: "in_progress",
            violationCount: 0,
            overallComment: null,
            resultViewedAt: null,
          };
          db.attempts.push(attempt);
          return { attemptId: attempt.id };
        }),
      );
    },

    async attempt(attemptId: number): Promise<AttemptState> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          expireIfDue(db, attempt);
          return attemptState(db, attempt, user);
        }),
      );
    },

    /**
     * Just the server's clock for an attempt. The exam screen asks for it whenever the student
     * comes back to the tab, so a countdown that fell behind while the phone slept is corrected.
     */
    async clock(attemptId: number): Promise<ClockInfo> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          expireIfDue(db, attempt);
          return { serverNow: nowIso(), deadlineAt: attempt.deadlineAt, status: attempt.status };
        }),
      );
    },

    /** Idempotent autosave of one answer and/or its flag. Also returns the server clock. */
    async saveAnswer(attemptId: number, questionId: number, patch: SaveAnswerPatch): Promise<SyncInfo> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          if (expireIfDue(db, attempt)) {
            throw new ApiError("expired", "Time's up. Your exam was submitted with everything you had saved.");
          }
          if (attempt.status !== "in_progress") throw new ApiError("conflict", "This exam has already been handed in.");

          const question = db.questions.find((q) => q.id === questionId && q.examId === sessionOf(db, attempt).examId);
          if (!question) throw new ApiError("not_found", "That question isn't part of this exam.");

          if (patch.response != null) {
            const value = patch.response;
            const valid =
              question.kind === "mcq"
                ? !!question.options?.some((o) => o.key === value)
                : question.kind === "true_false"
                  ? value === "true" || value === "false"
                  : value.length <= 6000;
            if (!valid) throw new ApiError("validation", "That answer isn't valid for this question.");
          }

          let record = db.answers.find((a) => a.attemptId === attemptId && a.questionId === questionId);
          if (!record) {
            record = { attemptId, questionId, response: null, flagged: false, awardedMarks: null, feedback: null };
            db.answers.push(record);
          }
          if ("response" in patch) record.response = patch.response ?? null;
          if (patch.flagged !== undefined) record.flagged = patch.flagged;

          return { serverNow: nowIso(), deadlineAt: attempt.deadlineAt };
        }),
      );
    },

    /** One call per time the student leaves the exam window. The third submits the exam. */
    async recordViolation(attemptId: number, kind: "hidden" | "blur" = "hidden"): Promise<ViolationOutcome> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          if (expireIfDue(db, attempt)) throw new ApiError("expired", "Time's up. Your exam was submitted.");
          if (attempt.status !== "in_progress") throw new ApiError("conflict", "This exam has already been handed in.");

          attempt.violationCount += 1;
          db.violations.push({ attemptId, at: nowIso(), kind });
          const autoSubmitted = attempt.violationCount >= MAX_VIOLATIONS;
          if (autoSubmitted) finalize(db, attempt, "violations");
          return { count: attempt.violationCount, max: MAX_VIOLATIONS, autoSubmitted };
        }),
      );
    },

    /** Idempotent: submitting twice just returns the summary. */
    async submit(attemptId: number, reason: "manual" | "timeout" = "manual"): Promise<SubmittedSummary> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          if (attempt.status === "in_progress") {
            expireIfDue(db, attempt);
          }
          if (attempt.status === "in_progress") {
            const late = Date.now() >= Date.parse(attempt.deadlineAt);
            finalize(db, attempt, late || reason === "timeout" ? "timeout" : "manual");
          }
          return submittedSummary(db, attempt, user);
        }),
      );
    },

    async submitted(attemptId: number): Promise<SubmittedSummary> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          expireIfDue(db, attempt);
          if (attempt.status === "in_progress") throw new ApiError("conflict", "This exam hasn't been handed in yet.");
          return submittedSummary(db, attempt, user);
        }),
      );
    },

    async results(): Promise<StudentResults> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const mine = db.attempts.filter((a) => a.studentId === user.id && a.status !== "in_progress");
          const bySubject = new Map<string, SubjectResults>();

          for (const attempt of mine) {
            const session = sessionOf(db, attempt);
            const cls = db.classes.find((c) => c.id === session.classId)!;
            const group =
              bySubject.get(cls.subjectCode) ??
              { subjectCode: cls.subjectCode, subjectName: subjectTitle(cls), subjectShort: subjectShort(cls), items: [] };
            bySubject.set(cls.subjectCode, group);

            const title = examOf(db, session).title;
            if (isReleased(db, attempt)) {
              const s = summarise(db, attempt);
              group.items.push({
                kind: "released",
                attemptId: s.attemptId,
                title,
                score: s.score,
                total: s.total,
                percent: s.percent,
                grade: s.grade,
                releasedAt: s.releasedAt,
                isNew: s.isNew,
              });
            } else {
              group.items.push({
                kind: "pending",
                attemptId: attempt.id,
                title,
                submittedAt: attempt.submittedAt ?? nowIso(),
                stage: attempt.status === "marked" ? "release" : "marking",
              });
            }
          }

          const subjects = [...bySubject.values()];
          let released: Extract<ResultListItem, { kind: "released" }>[] = [];

          for (const group of subjects) {
            const chronological = group.items
              .filter((i): i is Extract<ResultListItem, { kind: "released" }> => i.kind === "released")
              .sort((x, y) => x.releasedAt.localeCompare(y.releasedAt));
            chronological.forEach((item, index) => {
              if (index > 0) item.previousGrade = chronological[index - 1].grade;
            });
            released = released.concat(chronological);
            group.items.sort((x, y) => {
              if (x.kind !== y.kind) return x.kind === "released" ? -1 : 1;
              return x.kind === "released" && y.kind === "released" ? y.releasedAt.localeCompare(x.releasedAt) : 0;
            });
          }

          const newest = [...released].sort((x, y) => y.releasedAt.localeCompare(x.releasedAt))[0];
          const newestGroup = newest && subjects.find((g) => g.items.includes(newest));

          return {
            student: profileOf(db, user),
            subjects,
            releasedCount: released.length,
            pendingCount: subjects.reduce((n, g) => n + g.items.filter((i) => i.kind === "pending").length, 0),
            latest: newest
              ? { subjectShort: newestGroup?.subjectShort ?? "", title: newest.title, grade: newest.grade, percent: newest.percent }
              : null,
          };
        }),
      );
    },

    /** Only available once the teacher has released results. Opening it clears the "new" badge. */
    async result(attemptId: number): Promise<ResultDetail> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          if (!isReleased(db, attempt)) throw new ApiError("not_found", "These results haven't been released yet.");
          attempt.resultViewedAt ??= nowIso();

          const session = sessionOf(db, attempt);
          const exam = examOf(db, session);
          const cls = db.classes.find((c) => c.id === session.classId)!;
          const teacher = db.users.find((u) => u.id === exam.ownerId);
          const { score: got, total } = score(db, attempt);
          const records = answersOf(db, attempt.id);

          return {
            attemptId: attempt.id,
            title: exam.title,
            subjectName: subjectTitle(cls),
            teacher: teacherLabel(teacher),
            teacherInitials: initials(teacher?.name ?? "Teacher"),
            score: got,
            total,
            percent: percentOf(got, total),
            grade: gradeFor(got, total),
            overallComment: attempt.overallComment,
            releasedAt: session.resultsReleasedAt!,
            student: profileOf(db, user),
            questions: questionsOf(db, exam.id).map((q) => {
              const record: AnswerRecord | undefined = records.find((r) => r.questionId === q.id);
              return {
                position: q.position,
                kind: q.kind,
                prompt: q.prompt,
                points: q.points,
                awarded: record?.awardedMarks ?? 0,
                yourAnswer: yourAnswerText(q, record?.response ?? null),
                correctAnswer: correctAnswerText(q),
                feedback: record?.feedback ?? null,
              };
            }),
          };
        }),
      );
    },

    async dismissNewResult(attemptId: number): Promise<void> {
      return call(() =>
        mutate((db) => {
          const user = currentStudent(db);
          const attempt = ownedAttempt(db, attemptId, user);
          attempt.resultViewedAt ??= nowIso();
        }),
      );
    },
  },

  /** Demo helpers that stand in for screens that don't exist yet (teacher marking, admin). */
  dev: {
    reset(): void {
      resetDb();
    },

    setOffline(on: boolean): void {
      setSimulatingOffline(on);
    },

    /** Pretend the sign-in expired on the server: the next request will be refused. */
    expireSession(): void {
      setSessionUserId(null);
    },

    isOffline(): boolean {
      return isSimulatingOffline();
    },

    setViolationsDisabled(on: boolean): void {
      setViolationGuardDisabled(on);
    },

    isViolationsDisabled(): boolean {
      return isViolationGuardDisabled();
    },

    /** Pretend the teacher marked the written answers and released results. */
    teacherFinish(): { title: string } {
      return mutate((db) => {
        const user = currentStudent(db);
        const attempt = [...db.attempts]
          .filter((a) => a.studentId === user.id && a.status !== "in_progress" && !isReleased(db, a))
          .sort((x, y) => (y.submittedAt ?? "").localeCompare(x.submittedAt ?? ""))[0];
        if (!attempt) throw new ApiError("not_found", "Submit an exam first, then the teacher can mark it.");

        const session = sessionOf(db, attempt);
        const feedbackByQuestion: Record<number, string> = {
          107: "You spotted that petrol is a necessity with few substitutes. Next time, link each reason back to why demand changes by less than the price does.",
          108: "A clear shift of supply to the left, and the right conclusion on price and quantity. Use elasticity, or a contraction along the demand curve, to reach full marks.",
        };
        for (const record of answersOf(db, attempt.id)) {
          const question = db.questions.find((q) => q.id === record.questionId)!;
          if (question.kind === "written" && record.awardedMarks == null) {
            record.awardedMarks = Math.min(question.points, Math.max(1, Math.round(question.points * 0.7)));
            record.feedback = feedbackByQuestion[question.id] ?? "Good effort. Keep building each point with a reason.";
          }
        }
        attempt.status = "marked";
        attempt.overallComment =
          "Solid work on the quick questions, and your written answers show you understand the ideas. Now practise linking each cause to its effect, one step at a time.";
        session.status = "closed";
        session.resultsReleasedAt = nowIso();
        return { title: examOf(db, session).title };
      });
    },

    /** Move an attempt's deadline so the timer and time-up path can be tested quickly. */
    setTimeLeft(attemptId: number, seconds: number): void {
      mutate((db) => {
        const attempt = db.attempts.find((a) => a.id === attemptId);
        if (attempt && attempt.status === "in_progress") {
          attempt.deadlineAt = new Date(Date.now() + seconds * 1000).toISOString();
        }
      });
    },

    setSessionStatus(sessionId: number, status: ExamSession["status"]): void {
      mutate((db) => {
        const session = db.sessions.find((s) => s.id === sessionId);
        if (session) session.status = status;
      });
    },

    openSessions(): { id: number; label: string; status: ExamSession["status"] }[] {
      const db = readDb();
      return db.sessions
        .filter((s) => s.examId === 1)
        .map((s) => ({
          id: s.id,
          label: db.classes.find((c) => c.id === s.classId)?.name ?? `Session ${s.id}`,
          status: s.status,
        }));
    },
  },
};

/**
 * What the screens import. By default the auth and student calls go to the Laravel API; the teacher
 * and admin calls (in api-staff.ts) and the demo-tools helpers still run on the in-browser data.
 */
export const api = USE_MOCK
  ? mockApi
  : {
      ...mockApi,
      auth: realAuth,
      student: realStudent,
      dev: {
        ...mockApi.dev,
        /** End the session on the server but keep the screen as it is, so the next call is refused like an expired sign-in. */
        expireSession(): void {
          void request("POST", "/auth/logout", undefined, { silent: true }).catch(() => undefined);
        },
      },
    };

function submittedSummary(db: DbState, attempt: Attempt, user: User): SubmittedSummary {
  const session = sessionOf(db, attempt);
  const exam = examOf(db, session);
  const questions = questionsOf(db, exam.id);
  const records = answersOf(db, attempt.id);
  const answered = questions.filter((q) => hasAnswer(q.kind, records.find((r) => r.questionId === q.id)?.response)).length;

  return {
    attemptId: attempt.id,
    title: exam.title,
    student: profileOf(db, user),
    teacher: teacherOfExam(db, exam),
    submittedAt: attempt.submittedAt ?? nowIso(),
    reason: attempt.submitReason ?? "manual",
    answered,
    questionCount: questions.length,
    awaitingMarking: attempt.status === "submitted",
    status: attempt.status,
    resultsReleased: isReleased(db, attempt),
  };
}
