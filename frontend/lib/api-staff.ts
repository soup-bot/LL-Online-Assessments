/**
 * Teacher and admin side of the mock API. Same contract as the student side in `api.ts`: each
 * function becomes a fetch() when the Laravel API exists. Rules the server must enforce
 * (publish lock, approval, close/release gating, ownership) live here so the screens can't
 * be the only thing keeping them true.
 */

import {
  ApiError,
  answersOf,
  call,
  examOf,
  expireIfDue,
  finalize,
  nowIso,
  questionsOf,
  score,
  sessionOf,
  totalMarks,
} from "@/lib/api";
import { gradeFor, hasAnswer, normalizeText, percentOf } from "@/lib/grading";
import { mutate, sessionUserId } from "@/lib/mock/db";
import type {
  AdminClassesData,
  AdminExamRow,
  AdminExamsData,
  AdminExamStatus,
  ClassCard,
  ClassChip,
  ClassInput,
  EditorQuestion,
  ExamBuilder,
  ExamSessions,
  ExamSettingsPatch,
  ExamStage,
  LiveData,
  LiveRow,
  MarkingData,
  PersonLite,
  QuestionDraft,
  SaveMarksInput,
  StaffProfile,
  TeacherClass,
  ToMarkItem,
  TutorExamRow,
  TutorHome,
  UserInput,
  UserRow,
  UsersData,
} from "@/lib/staff-types";
import type { Attempt, DbState, Exam, ExamSession, Question, QuestionKind, SchoolClass, User } from "@/lib/types";
import { firstName, formatTime, initials, plural } from "@/lib/utils";

/* ----------------------------------------------------------------- helpers */

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

const nextId = (rows: { id: number }[], floor = 0) => Math.max(floor, ...rows.map((r) => r.id)) + 1;
const batchOf = (cls: SchoolClass) => cls.name.split(",")[1]?.trim() ?? cls.name;

const person = (u: User): PersonLite => ({ id: u.id, name: u.name, initials: initials(u.name) });

function staffUser(db: DbState): User {
  const user = db.users.find((u) => u.id === sessionUserId());
  if (!user) throw new ApiError("unauthorized", "Your session has ended. Please sign in again.");
  if (user.role === "student") throw new ApiError("forbidden", "This area is for teachers and admins.");
  return user;
}

function tutorUser(db: DbState): User {
  const user = staffUser(db);
  if (user.role !== "tutor") throw new ApiError("forbidden", "Only a teacher can change exams.");
  return user;
}

function adminUser(db: DbState): User {
  const user = staffUser(db);
  if (user.role !== "admin") throw new ApiError("forbidden", "This area is for admins.");
  return user;
}

/** An exam the user may look at: a teacher's own, or any exam for an admin. */
function readableExam(db: DbState, user: User, examId: number): Exam {
  const exam = db.exams.find((e) => e.id === examId);
  if (!exam || (user.role === "tutor" && exam.ownerId !== user.id)) {
    throw new ApiError("not_found", "We couldn't find that exam.");
  }
  return exam;
}

function writableExam(db: DbState, examId: number): { exam: Exam; user: User } {
  const user = tutorUser(db);
  return { exam: readableExam(db, user, examId), user };
}

function draftExam(db: DbState, examId: number): { exam: Exam; user: User } {
  const found = writableExam(db, examId);
  if (found.exam.status !== "draft") {
    throw new ApiError("conflict", "This exam is published, so its questions and settings are locked.");
  }
  return found;
}

function readableSession(db: DbState, user: User, sessionId: number): ExamSession {
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session) throw new ApiError("not_found", "We couldn't find that class.");
  readableExam(db, user, session.examId);
  return session;
}

function writableSession(db: DbState, sessionId: number): ExamSession {
  const user = tutorUser(db);
  return readableSession(db, user, sessionId);
}

function readableAttempt(db: DbState, user: User, attemptId: number): Attempt {
  const attempt = db.attempts.find((a) => a.id === attemptId);
  if (!attempt) throw new ApiError("not_found", "We couldn't find that submission.");
  readableSession(db, user, attempt.sessionId);
  return attempt;
}

const classOf = (db: DbState, id: number) => db.classes.find((c) => c.id === id)!;
const attemptsOf = (db: DbState, sessionId: number) => db.attempts.filter((a) => a.sessionId === sessionId);

function expireAll(db: DbState, sessionId: number) {
  for (const a of attemptsOf(db, sessionId)) expireIfDue(db, a);
}

function profile(user: User): StaffProfile {
  return { id: user.id, name: user.name, initials: initials(user.name), email: user.email, role: user.role as "tutor" | "admin" };
}

/* ------------------------------------------------------- answer key checks */

/** What is missing from a question's answer key, or null when it is complete. */
export function keyIssue(q: Question): string | null {
  if (!q.prompt.trim()) return "Write the question first.";
  if (!Number.isInteger(q.points) || q.points < 1) return "Give the question at least 1 mark.";
  const key = q.answerKey;
  switch (key.kind) {
    case "mcq":
      if ((q.options ?? []).length < 4 || (q.options ?? []).some((o) => !o.text.trim())) return "Fill in all four options.";
      return key.correct ? null : "Choose the correct option.";
    case "true_false":
      return key.correct == null ? "Choose whether the statement is true or false." : null;
    case "fill_blank":
      if (!/_{3,}/.test(q.prompt)) return "Put ____ in the sentence where the blank goes.";
      if ((q.prompt.match(/_{3,}/g) ?? []).length > 1) return "Use one blank per question. Split it into separate questions if you need more.";
      return key.accepted.some((a) => normalizeText(a)) ? null : "Add at least one accepted answer.";
    case "written":
      return key.markingPoints.some((p) => p.trim()) ? null : "Add at least one marking point.";
  }
}

function buildQuestion(id: number, examId: number, position: number, d: QuestionDraft): Question {
  const base = { id, examId, position, kind: d.kind, prompt: d.prompt.trim(), points: Math.round(Number(d.points) || 0), approved: false };
  switch (d.kind) {
    case "mcq":
      return {
        ...base,
        options: OPTION_KEYS.map((key, i) => ({ key, text: (d.options[i] ?? "").trim() })),
        answerKey: { kind: "mcq", correct: d.correct },
      };
    case "true_false":
      return { ...base, answerKey: { kind: "true_false", correct: d.trueFalse } };
    case "fill_blank":
      return { ...base, answerKey: { kind: "fill_blank", accepted: d.accepted.map((a) => a.trim()).filter(Boolean) } };
    case "written":
      return { ...base, answerKey: { kind: "written", markingPoints: d.markingPoints.map((p) => p.trim()).filter(Boolean) } };
  }
}

function toDraft(q: Question): QuestionDraft {
  const key = q.answerKey;
  return {
    kind: q.kind,
    prompt: q.prompt,
    points: q.points,
    options: OPTION_KEYS.map((k) => q.options?.find((o) => o.key === k)?.text ?? ""),
    correct: key.kind === "mcq" ? key.correct : "",
    trueFalse: key.kind === "true_false" ? key.correct : null,
    accepted: key.kind === "fill_blank" ? key.accepted : [],
    markingPoints: key.kind === "written" ? key.markingPoints : [],
    approved: q.approved,
  };
}

/* ------------------------------------------------------------ roll-up views */

function stageOf(db: DbState, exam: Exam, sessions: ExamSession[]): ExamStage {
  if (exam.status === "draft") return "draft";
  if (sessions.some((s) => s.status === "open")) return "live";
  if (sessions.some((s) => attemptsOf(db, s.id).some((a) => a.status === "submitted"))) return "marking";
  if (sessions.some((s) => s.resultsReleasedAt)) return "released";
  return "ready";
}

function chip(db: DbState, s: ExamSession): ClassChip {
  return { sessionId: s.id, classId: s.classId, label: batchOf(classOf(db, s.classId)), status: s.status, released: s.resultsReleasedAt != null };
}

function examRow(db: DbState, exam: Exam): TutorExamRow {
  const sessions = db.sessions.filter((s) => s.examId === exam.id);
  for (const s of sessions) expireAll(db, s.id);
  const questions = questionsOf(db, exam.id);
  const attempts = sessions.flatMap((s) => attemptsOf(db, s.id));
  const marked = attempts.filter((a) => a.status === "marked");
  const percents = marked.map((a) => {
    const r = score(db, a);
    return (r.score / Math.max(r.total, 1)) * 100;
  });
  const releasedAt = sessions.map((s) => s.resultsReleasedAt).filter((x): x is string => !!x).sort().at(-1) ?? null;

  return {
    id: exam.id,
    title: exam.title,
    status: exam.status,
    stage: stageOf(db, exam, sessions),
    timeLimitMinutes: exam.timeLimitMinutes,
    questionCount: questions.length,
    totalMarks: totalMarks(questions),
    approvedCount: questions.filter((q) => q.approved).length,
    classes: sessions.map((s) => chip(db, s)),
    submitted: attempts.filter((a) => a.status !== "in_progress").length,
    studentTotal: sessions.reduce((n, s) => n + classOf(db, s.classId).studentIds.length, 0),
    toMark: attempts.filter((a) => a.status === "submitted").length,
    averagePercent: percents.length ? Math.round((percents.reduce((x, y) => x + y, 0) / percents.length) * 10) / 10 : null,
    releasedAt,
  };
}

function classCard(db: DbState, session: ExamSession): ClassCard {
  const cls = classOf(db, session.classId);
  const attempts = attemptsOf(db, session.id);
  return {
    sessionId: session.id,
    classId: cls.id,
    name: cls.name,
    label: batchOf(cls),
    status: session.status,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    releasedAt: session.resultsReleasedAt,
    students: cls.studentIds.length,
    sitting: attempts.filter((a) => a.status === "in_progress").length,
    handedIn: attempts.filter((a) => a.status !== "in_progress").length,
    toMark: attempts.filter((a) => a.status === "submitted").length,
    notStarted: cls.studentIds.length - attempts.length,
  };
}

function objectiveScore(db: DbState, attempt: Attempt) {
  const questions = questionsOf(db, sessionOf(db, attempt).examId).filter((q) => q.kind !== "written");
  const records = answersOf(db, attempt.id);
  return {
    score: questions.reduce((n, q) => n + (records.find((r) => r.questionId === q.id)?.awardedMarks ?? 0), 0),
    total: questions.reduce((n, q) => n + q.points, 0),
  };
}

function answeredCount(db: DbState, attempt: Attempt): number {
  const questions = questionsOf(db, sessionOf(db, attempt).examId);
  const records = answersOf(db, attempt.id);
  return questions.filter((q) => hasAnswer(q.kind, records.find((r) => r.questionId === q.id)?.response)).length;
}

const REASON_TEXT = {
  manual: "Submitted by student",
  timeout: "Time ran out",
  violations: "Auto-submitted after 3 violations",
  closed: "Submitted when you closed the exam",
} as const;

function liveRow(db: DbState, session: ExamSession, student: User): LiveRow {
  const attempt = attemptsOf(db, session.id).find((a) => a.studentId === student.id);
  const questionCount = questionsOf(db, session.examId).length;
  const base = { studentId: student.id, name: student.name, initials: initials(student.name), questionCount, violations: 0, secondsLeft: null, grade: null };

  if (!attempt) {
    return session.status === "closed"
      ? { ...base, attemptId: null, state: "not_attempted", detail: "Didn't sit this exam", answered: 0, scoreText: "Not attempted" }
      : { ...base, attemptId: null, state: "not_started", detail: "Not started yet", answered: 0, scoreText: "—" };
  }

  const answered = answeredCount(db, attempt);
  const common = { ...base, attemptId: attempt.id, answered, violations: attempt.violationCount };

  if (attempt.status === "in_progress") {
    const left = Math.max(0, Math.round((Date.parse(attempt.deadlineAt) - Date.now()) / 1000));
    const mins = Math.floor(left / 60);
    return { ...common, state: "sitting", detail: `Sitting now · ${mins}:${String(left % 60).padStart(2, "0")} left`, secondsLeft: left, scoreText: "—" };
  }

  const when = attempt.submittedAt ? ` · ${formatTime(attempt.submittedAt)}` : "";
  const detail = `${REASON_TEXT[attempt.submitReason ?? "manual"]}${when}`;
  if (attempt.status === "submitted") {
    const o = objectiveScore(db, attempt);
    return { ...common, state: "to_mark", detail, scoreText: `${o.score} / ${o.total} auto` };
  }
  const r = score(db, attempt);
  const grade = gradeFor(r.score, r.total);
  return { ...common, state: "marked", detail, scoreText: `${r.score} / ${r.total} · ${grade}`, grade };
}

/* -------------------------------------------------------------- teacher API */

export const tutorApi = {
  async home(): Promise<TutorHome> {
    return call(() =>
      mutate((db) => {
        const user = tutorUser(db);
        const exams = db.exams.filter((e) => e.ownerId === user.id).map((e) => examRow(db, e)).sort((a, b) => b.id - a.id);
        return {
          tutor: profile(user),
          stats: {
            open: exams.reduce((n, e) => n + e.classes.filter((c) => c.status === "open").length, 0),
            toMark: exams.reduce((n, e) => n + e.toMark, 0),
            drafts: exams.filter((e) => e.status === "draft").length,
          },
          exams,
        };
      }),
    );
  },

  /** Number of submissions waiting for this teacher, for the badge in the header. */
  async toMarkCount(): Promise<number> {
    return call(() =>
      mutate((db) => {
        const user = tutorUser(db);
        const mine = db.exams.filter((e) => e.ownerId === user.id).map((e) => e.id);
        const sessionIds = db.sessions.filter((s) => mine.includes(s.examId)).map((s) => s.id);
        sessionIds.forEach((id) => expireAll(db, id));
        return db.attempts.filter((a) => sessionIds.includes(a.sessionId) && a.status === "submitted").length;
      }),
    );
  },

  async toMark(): Promise<ToMarkItem[]> {
    return call(() =>
      mutate((db) => {
        const user = tutorUser(db);
        const mine = db.exams.filter((e) => e.ownerId === user.id).map((e) => e.id);
        const sessions = db.sessions.filter((s) => mine.includes(s.examId));
        sessions.forEach((s) => expireAll(db, s.id));
        return db.attempts
          .filter((a) => a.status === "submitted" && sessions.some((s) => s.id === a.sessionId))
          .map((a) => {
            const session = sessionOf(db, a);
            const written = questionsOf(db, session.examId).filter((q) => q.kind === "written");
            return {
              attemptId: a.id,
              student: person(db.users.find((u) => u.id === a.studentId)!),
              examTitle: examOf(db, session).title,
              className: classOf(db, session.classId).name,
              submittedAt: a.submittedAt ?? a.startedAt,
              writtenCount: written.length,
            };
          })
          .sort((x, y) => x.submittedAt.localeCompare(y.submittedAt));
      }),
    );
  },

  async classes(): Promise<TeacherClass[]> {
    return call(() =>
      mutate((db) => {
        const user = tutorUser(db);
        return db.classes
          .filter((c) => c.tutorId === user.id)
          .map((c) => ({
            id: c.id,
            name: c.name,
            subjectCode: c.subjectCode,
            grade: c.grade,
            students: c.studentIds.map((id) => person(db.users.find((u) => u.id === id)!)),
            exams: db.sessions
              .filter((s) => s.classId === c.id)
              .map((s) => ({ examId: s.examId, sessionId: s.id, title: examOf(db, s).title, status: s.status, released: s.resultsReleasedAt != null })),
          }));
      }),
    );
  },

  /* -------- building an exam -------- */

  async createExam(): Promise<{ examId: number }> {
    return call(() =>
      mutate((db) => {
        const user = tutorUser(db);
        const id = nextId(db.exams);
        db.exams.push({ id, title: "Untitled exam", ownerId: user.id, timeLimitMinutes: 30, navigation: "any", rules: "", status: "draft", publishedAt: null });
        let sid = nextId(db.sessions);
        for (const cls of db.classes.filter((c) => c.tutorId === user.id)) {
          db.sessions.push({ id: sid++, examId: id, classId: cls.id, status: "not_open", openedAt: null, closedAt: null, resultsReleasedAt: null });
        }
        return { examId: id };
      }),
    );
  },

  async builder(examId: number): Promise<ExamBuilder> {
    return call(() =>
      mutate((db) => {
        const user = staffUser(db);
        const exam = readableExam(db, user, examId);
        const questions = questionsOf(db, exam.id);
        const approvedCount = questions.filter((q) => q.approved).length;
        const sessions = db.sessions.filter((s) => s.examId === exam.id);
        const mine = db.classes.filter((c) => c.tutorId === exam.ownerId);

        let publishBlocker: string | null = null;
        if (exam.status === "published") publishBlocker = "Already published.";
        else if (!exam.title.trim()) publishBlocker = "Give the exam a title.";
        else if (questions.length === 0) publishBlocker = "Add at least one question.";
        else if (approvedCount < questions.length) publishBlocker = `Approve all ${questions.length} to publish.`;
        else if (sessions.length === 0) publishBlocker = "Choose at least one class.";

        return {
          id: exam.id,
          title: exam.title,
          status: exam.status,
          timeLimitMinutes: exam.timeLimitMinutes,
          navigation: exam.navigation,
          rules: exam.rules,
          questions: questions.map((q) => ({ id: q.id, position: q.position, kind: q.kind, prompt: q.prompt, points: q.points, approved: q.approved })),
          totalMarks: totalMarks(questions),
          approvedCount,
          classes: mine.map((c) => {
            const s = sessions.find((x) => x.classId === c.id);
            return { classId: c.id, name: c.name, linked: !!s, sessionStatus: s?.status ?? null };
          }),
          publishBlocker,
          canEdit: user.role === "tutor" && exam.status === "draft",
        };
      }),
    );
  },

  async updateExam(examId: number, patch: ExamSettingsPatch): Promise<void> {
    return call(() =>
      mutate((db) => {
        const { exam, user } = draftExam(db, examId);
        if (patch.title !== undefined) exam.title = patch.title.trim().slice(0, 120);
        if (patch.timeLimitMinutes !== undefined) {
          const m = Math.round(patch.timeLimitMinutes);
          if (!Number.isFinite(m) || m < 1 || m > 600) throw new ApiError("validation", "Time limit must be between 1 and 600 minutes.");
          exam.timeLimitMinutes = m;
        }
        if (patch.navigation) exam.navigation = patch.navigation;
        if (patch.rules !== undefined) exam.rules = patch.rules;
        if (patch.classIds) {
          const wanted = new Set(patch.classIds.filter((id) => db.classes.some((c) => c.id === id && c.tutorId === user.id)));
          db.sessions = db.sessions.filter((s) => s.examId !== exam.id || wanted.has(s.classId));
          let sid = nextId(db.sessions);
          for (const classId of wanted) {
            if (!db.sessions.some((s) => s.examId === exam.id && s.classId === classId)) {
              db.sessions.push({ id: sid++, examId: exam.id, classId, status: "not_open", openedAt: null, closedAt: null, resultsReleasedAt: null });
            }
          }
        }
      }),
    );
  },

  async publish(examId: number): Promise<void> {
    return call(() =>
      mutate((db) => {
        const { exam } = draftExam(db, examId);
        const questions = questionsOf(db, exam.id);
        if (!exam.title.trim()) throw new ApiError("validation", "Give the exam a title first.");
        if (questions.length === 0) throw new ApiError("validation", "Add at least one question first.");
        if (questions.some((q) => !q.approved)) throw new ApiError("validation", "Approve every question before publishing.");
        if (!db.sessions.some((s) => s.examId === exam.id)) throw new ApiError("validation", "Choose at least one class first.");
        exam.status = "published";
        exam.publishedAt = nowIso();
      }),
    );
  },

  /* -------- questions -------- */

  async question(examId: number, questionId: number | null, kind?: QuestionKind): Promise<EditorQuestion> {
    return call(() =>
      mutate((db) => {
        const user = staffUser(db);
        const exam = readableExam(db, user, examId);
        const questions = questionsOf(db, exam.id);
        const locked = user.role !== "tutor" || exam.status !== "draft";

        if (questionId == null) {
          const k = kind ?? "mcq";
          return {
            id: null,
            position: questions.length + 1,
            total: questions.length + 1,
            examTitle: exam.title,
            locked,
            draft: {
              kind: k,
              prompt: k === "fill_blank" ? "Type the sentence and put ________ where the blank goes." : "",
              points: k === "written" ? 4 : 1,
              options: ["", "", "", ""],
              correct: "",
              trueFalse: null,
              accepted: [],
              markingPoints: [],
              approved: false,
            },
          };
        }
        const q = questions.find((x) => x.id === questionId);
        if (!q) throw new ApiError("not_found", "We couldn't find that question.");
        return { id: q.id, position: q.position, total: questions.length, examTitle: exam.title, locked, draft: toDraft(q) };
      }),
    );
  },

  async saveQuestion(examId: number, questionId: number | null, draft: QuestionDraft): Promise<{ questionId: number }> {
    return call(() =>
      mutate((db) => {
        const { exam } = draftExam(db, examId);
        const existing = questionId == null ? null : db.questions.find((q) => q.id === questionId && q.examId === exam.id);
        if (questionId != null && !existing) throw new ApiError("not_found", "We couldn't find that question.");

        const id = existing?.id ?? nextId(db.questions, 1000);
        const position = existing?.position ?? questionsOf(db, exam.id).length + 1;
        const next = buildQuestion(id, exam.id, position, draft);

        const issue = keyIssue(next);
        if (next.kind === "fill_blank" && (next.prompt.match(/_{3,}/g) ?? []).length > 1) throw new ApiError("validation", "Use one blank per question. Split it into separate questions if you need more.");
        if (!next.prompt) throw new ApiError("validation", "Write the question first.");
        if (!Number.isInteger(next.points) || next.points < 1) throw new ApiError("validation", "Give the question at least 1 mark.");
        if (draft.approved) {
          if (issue) throw new ApiError("validation", `Finish the answer key before approving. ${issue}`);
          next.approved = true;
        }

        if (existing) Object.assign(existing, next);
        else db.questions.push(next);
        return { questionId: id };
      }),
    );
  },

  async deleteQuestion(examId: number, questionId: number): Promise<void> {
    return call(() =>
      mutate((db) => {
        const { exam } = draftExam(db, examId);
        db.questions = db.questions.filter((q) => !(q.id === questionId && q.examId === exam.id));
        questionsOf(db, exam.id).forEach((q, i) => (q.position = i + 1));
      }),
    );
  },

  async setApproved(examId: number, questionId: number, approved: boolean): Promise<void> {
    return call(() =>
      mutate((db) => {
        const { exam } = draftExam(db, examId);
        const q = db.questions.find((x) => x.id === questionId && x.examId === exam.id);
        if (!q) throw new ApiError("not_found", "We couldn't find that question.");
        if (approved) {
          const issue = keyIssue(q);
          if (issue) throw new ApiError("validation", `Question ${q.position} isn't ready to approve. ${issue}`);
        }
        q.approved = approved;
      }),
    );
  },

  async importQuestions(examId: number, drafts: QuestionDraft[]): Promise<{ added: number }> {
    return call(() =>
      mutate((db) => {
        const { exam } = draftExam(db, examId);
        let id = nextId(db.questions, 1000);
        let position = questionsOf(db, exam.id).length;
        for (const d of drafts) {
          db.questions.push({ ...buildQuestion(id++, exam.id, ++position, d), approved: false });
        }
        return { added: drafts.length };
      }),
    );
  },

  /* -------- running an exam -------- */

  async sessions(examId: number): Promise<ExamSessions> {
    return call(() =>
      mutate((db) => {
        const user = staffUser(db);
        const exam = readableExam(db, user, examId);
        const sessions = db.sessions.filter((s) => s.examId === exam.id);
        sessions.forEach((s) => expireAll(db, s.id));
        const questions = questionsOf(db, exam.id);
        return {
          exam: { id: exam.id, title: exam.title, status: exam.status, questionCount: questions.length, totalMarks: totalMarks(questions) },
          canEdit: user.role === "tutor",
          classes: sessions.map((s) => classCard(db, s)),
        };
      }),
    );
  },

  async live(sessionId: number): Promise<LiveData> {
    return call(() =>
      mutate((db) => {
        const user = staffUser(db);
        const session = readableSession(db, user, sessionId);
        expireAll(db, session.id);
        const cls = classOf(db, session.classId);
        const rows = cls.studentIds.map((id) => liveRow(db, session, db.users.find((u) => u.id === id)!));
        const card = classCard(db, session);
        return {
          card,
          rows,
          questionCount: questionsOf(db, session.examId).length,
          release: {
            closed: session.status === "closed",
            toMark: card.toMark,
            released: session.resultsReleasedAt != null,
            canRelease: session.status === "closed" && card.toMark === 0 && session.resultsReleasedAt == null,
          },
        };
      }),
    );
  },

  async openSession(sessionId: number): Promise<void> {
    return call(() =>
      mutate((db) => {
        const session = writableSession(db, sessionId);
        if (examOf(db, session).status !== "published") throw new ApiError("conflict", "Publish the exam before opening it.");
        if (session.status !== "not_open") throw new ApiError("conflict", "This class has already been opened.");
        session.status = "open";
        session.openedAt = nowIso();
      }),
    );
  },

  /** Closing hands in anyone still sitting, then the class is done: no one else can start. */
  async closeSession(sessionId: number): Promise<{ submitted: number }> {
    return call(() =>
      mutate((db) => {
        const session = writableSession(db, sessionId);
        if (session.status !== "open") throw new ApiError("conflict", "This class isn't open.");
        let submitted = 0;
        for (const a of attemptsOf(db, session.id)) {
          expireIfDue(db, a);
          if (a.status === "in_progress") {
            finalize(db, a, "closed");
            submitted += 1;
          }
        }
        session.status = "closed";
        session.closedAt = nowIso();
        return { submitted };
      }),
    );
  },

  async releaseResults(sessionId: number): Promise<void> {
    return call(() =>
      mutate((db) => {
        const session = writableSession(db, sessionId);
        expireAll(db, session.id);
        if (session.status !== "closed") throw new ApiError("conflict", "Close the exam for this class first.");
        if (session.resultsReleasedAt) throw new ApiError("conflict", "Results are already released.");
        const waiting = attemptsOf(db, session.id).filter((a) => a.status !== "marked").length;
        if (waiting > 0) throw new ApiError("conflict", `${plural(waiting, "submission")} still need marking.`);
        session.resultsReleasedAt = nowIso();
      }),
    );
  },

  /* -------- marking -------- */

  async attempt(attemptId: number): Promise<MarkingData> {
    return call(() =>
      mutate((db) => {
        const user = staffUser(db);
        const attempt = readableAttempt(db, user, attemptId);
        expireIfDue(db, attempt);
        const session = sessionOf(db, attempt);
        const exam = examOf(db, session);
        const student = db.users.find((u) => u.id === attempt.studentId)!;
        const questions = questionsOf(db, exam.id);
        const records = answersOf(db, attempt.id);
        const o = objectiveScore(db, attempt);

        const optionLabel = (q: Question, key: string | null) => {
          const opt = q.options?.find((x) => x.key === key);
          return opt ? `${opt.key}. ${opt.text}` : (key ?? "");
        };

        return {
          attemptId: attempt.id,
          examId: exam.id,
          sessionId: session.id,
          examTitle: exam.title,
          className: classOf(db, session.classId).name,
          student: person(student),
          firstName: firstName(student.name),
          submittedAt: attempt.submittedAt,
          submitReason: attempt.submitReason,
          answered: answeredCount(db, attempt),
          questionCount: questions.length,
          status: attempt.status,
          released: session.resultsReleasedAt != null,
          canEdit: user.role === "tutor" && session.resultsReleasedAt == null && attempt.status !== "in_progress",
          violations: db.violations.filter((v) => v.attemptId === attempt.id).map((v) => ({ at: v.at, kind: v.kind })),
          objective: questions
            .filter((q) => q.kind !== "written")
            .map((q) => {
              const r = records.find((x) => x.questionId === q.id);
              const answer = !hasAnswer(q.kind, r?.response)
                ? "Not answered"
                : q.kind === "mcq"
                  ? optionLabel(q, r!.response)
                  : q.kind === "true_false"
                    ? r!.response === "true"
                      ? "True"
                      : "False"
                    : (r!.response ?? "").trim();
              return { position: q.position, kind: q.kind, answer, awarded: r?.awardedMarks ?? 0, points: q.points };
            }),
          objectiveScore: o.score,
          objectiveTotal: o.total,
          written: questions
            .filter((q) => q.kind === "written")
            .map((q) => {
              const r = records.find((x) => x.questionId === q.id);
              return {
                questionId: q.id,
                position: q.position,
                points: q.points,
                prompt: q.prompt,
                answer: hasAnswer("written", r?.response) ? (r!.response ?? "") : null,
                markingPoints: q.answerKey.kind === "written" ? q.answerKey.markingPoints : [],
                ticks: r?.ticks ?? [],
                awarded: r?.awardedMarks ?? null,
                feedback: r?.feedback ?? "",
              };
            }),
          overallComment: attempt.overallComment ?? "",
          totalMarks: totalMarks(questions),
        };
      }),
    );
  },

  async saveMarks(attemptId: number, input: SaveMarksInput): Promise<{ score: number; total: number; grade: string }> {
    return call(() =>
      mutate((db) => {
        const user = tutorUser(db);
        const attempt = readableAttempt(db, user, attemptId);
        const session = sessionOf(db, attempt);
        if (attempt.status === "in_progress") throw new ApiError("conflict", "This student is still sitting the exam.");
        if (session.resultsReleasedAt) throw new ApiError("conflict", "Results are already released, so marks can't change.");

        const written = questionsOf(db, session.examId).filter((q) => q.kind === "written");
        for (const q of written) {
          const patch = input.answers.find((a) => a.questionId === q.id);
          if (!patch) throw new ApiError("validation", `Mark question ${q.position} before saving.`);
          if (!Number.isInteger(patch.awarded) || patch.awarded < 0 || patch.awarded > q.points) {
            throw new ApiError("validation", `Question ${q.position} is out of ${q.points} marks.`);
          }
          let record = db.answers.find((a) => a.attemptId === attempt.id && a.questionId === q.id);
          if (!record) {
            record = { attemptId: attempt.id, questionId: q.id, response: null, flagged: false, awardedMarks: null, feedback: null };
            db.answers.push(record);
          }
          record.awardedMarks = patch.awarded;
          record.feedback = patch.feedback.trim() || null;
          record.ticks = patch.ticks;
        }
        attempt.overallComment = input.overallComment.trim() || null;
        attempt.status = "marked";
        const r = score(db, attempt);
        return { score: r.score, total: r.total, grade: gradeFor(r.score, r.total) };
      }),
    );
  },
};

/* ---------------------------------------------------------------- admin API */

function classesText(db: DbState, user: User): string {
  if (user.role === "admin") return "All classes";
  if (user.role === "tutor") {
    const mine = db.classes.filter((c) => c.tutorId === user.id).map(batchOf);
    return mine.length ? `Teaches ${mine.join(", ")}` : "No classes yet";
  }
  const cls = db.classes.find((c) => c.studentIds.includes(user.id));
  return cls ? batchOf(cls) : "Not in a class";
}

function emailTaken(db: DbState, email: string, exceptId?: number) {
  return db.users.some((u) => u.id !== exceptId && u.email.toLowerCase() === email.toLowerCase());
}

export const adminApi = {
  async users(): Promise<UsersData> {
    return call(() =>
      mutate((db) => {
        adminUser(db);
        const users: UserRow[] = db.users.map((u) => ({ ...person(u), email: u.email, role: u.role, classes: classesText(db, u) }));
        return {
          users,
          counts: {
            tutors: users.filter((u) => u.role === "tutor").length,
            students: users.filter((u) => u.role === "student").length,
            admins: users.filter((u) => u.role === "admin").length,
          },
        };
      }),
    );
  },

  async saveUser(id: number | null, input: UserInput): Promise<void> {
    return call(() =>
      mutate((db) => {
        const me = adminUser(db);
        const name = input.name.trim();
        const email = input.email.trim().toLowerCase();
        if (!name) throw new ApiError("validation", "Enter a name.");
        if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError("validation", "Enter a valid email address.");
        if (emailTaken(db, email, id ?? undefined)) throw new ApiError("validation", "Someone already uses that email address.");

        if (id == null) {
          db.users.push({ id: nextId(db.users), name, email, role: input.role });
          return;
        }
        const user = db.users.find((u) => u.id === id);
        if (!user) throw new ApiError("not_found", "We couldn't find that user.");
        if (user.id === me.id && input.role !== "admin") throw new ApiError("validation", "You can't remove your own admin access.");
        if (user.role === "tutor" && input.role !== "tutor" && db.classes.some((c) => c.tutorId === user.id)) {
          throw new ApiError("conflict", "This teacher still has classes. Give those classes another teacher first.");
        }
        if (user.role === "tutor" && input.role !== "tutor" && db.exams.some((e) => e.ownerId === user.id)) {
          throw new ApiError("conflict", "This teacher still owns exams, so their role can't change.");
        }
        if (user.role === "student" && input.role !== "student") {
          if (db.attempts.some((a) => a.studentId === user.id)) throw new ApiError("conflict", "This student has exam attempts, so their role can't change.");
          db.classes.forEach((c) => (c.studentIds = c.studentIds.filter((s) => s !== user.id)));
        }
        user.name = name;
        user.email = email;
        user.role = input.role;
        if (input.role !== "tutor") delete user.honorific;
      }),
    );
  },

  async classes(): Promise<AdminClassesData> {
    return call(() =>
      mutate((db) => {
        adminUser(db);
        return {
          classes: db.classes.map((c) => ({
            id: c.id,
            name: c.name,
            subjectCode: c.subjectCode,
            grade: c.grade,
            tutorId: c.tutorId,
            students: c.studentIds.map((id) => person(db.users.find((u) => u.id === id)!)),
          })),
          tutors: db.users.filter((u) => u.role === "tutor").map(person),
          students: db.users
            .filter((u) => u.role === "student")
            .map((u) => ({ ...person(u), className: db.classes.find((c) => c.studentIds.includes(u.id))?.name ?? null })),
        };
      }),
    );
  },

  async saveClass(id: number | null, input: ClassInput): Promise<{ classId: number }> {
    return call(() =>
      mutate((db) => {
        adminUser(db);
        const name = input.name.trim();
        if (!name) throw new ApiError("validation", "Enter a class name.");
        if (!input.subjectCode.trim()) throw new ApiError("validation", "Enter a subject code.");
        if (!Number.isInteger(input.grade) || input.grade < 1 || input.grade > 13) throw new ApiError("validation", "Grade must be between 1 and 13.");
        const tutor = db.users.find((u) => u.id === input.tutorId && u.role === "tutor");
        if (!tutor) throw new ApiError("validation", "Choose a teacher for this class.");
        const students = [...new Set(input.studentIds)].filter((sid) => db.users.some((u) => u.id === sid && u.role === "student"));

        // A student sits in one class at a time: adding them here takes them out of any other.
        for (const other of db.classes) {
          if (other.id !== id) other.studentIds = other.studentIds.filter((sid) => !students.includes(sid));
        }

        let target = id == null ? undefined : db.classes.find((c) => c.id === id);
        if (id != null && !target) throw new ApiError("not_found", "We couldn't find that class.");
        if (target) {
          // Students with an attempt in this class's exams must stay, or their results would vanish.
          const sessionIds = db.sessions.filter((s) => s.classId === target!.id).map((s) => s.id);
          const locked = target.studentIds.filter((sid) => !students.includes(sid) && db.attempts.some((a) => sessionIds.includes(a.sessionId) && a.studentId === sid));
          if (locked.length) {
            const who = db.users.find((u) => u.id === locked[0])!.name;
            throw new ApiError("conflict", `${who} has already sat an exam in this class, so they can't be removed.`);
          }
          if (target.tutorId !== tutor.id && db.exams.some((e) => e.ownerId === target!.tutorId && db.sessions.some((s) => s.examId === e.id && s.classId === target!.id))) {
            throw new ApiError("conflict", "This class already has exams from its teacher, so the teacher can't change.");
          }
          Object.assign(target, { name, subjectCode: input.subjectCode.trim(), grade: input.grade, tutorId: tutor.id, studentIds: students });
        } else {
          target = { id: nextId(db.classes), name, subjectCode: input.subjectCode.trim(), grade: input.grade, tutorId: tutor.id, studentIds: students };
          db.classes.push(target);
        }
        return { classId: target.id };
      }),
    );
  },

  async exams(): Promise<AdminExamsData> {
    return call(() =>
      mutate((db) => {
        adminUser(db);
        const rows: AdminExamRow[] = [];
        for (const session of db.sessions) {
          const exam = examOf(db, session);
          if (exam.status !== "published") continue;
          expireAll(db, session.id);
          const cls = classOf(db, session.classId);
          const attempts = attemptsOf(db, session.id);
          const marked = attempts.filter((a) => a.status === "marked");
          const status: AdminExamStatus = session.resultsReleasedAt ? "released" : session.status;
          const percents = marked.map((a) => {
            const r = score(db, a);
            return percentOf(r.score, r.total);
          });
          rows.push({
            sessionId: session.id,
            examId: exam.id,
            title: exam.title,
            teacher: db.users.find((u) => u.id === exam.ownerId)?.name ?? "—",
            teacherId: exam.ownerId,
            classId: cls.id,
            className: batchOf(cls),
            status,
            handedIn: attempts.filter((a) => a.status !== "in_progress").length,
            students: cls.studentIds.length,
            marked: marked.length,
            averageText: session.resultsReleasedAt && percents.length ? `Average ${Math.round(percents.reduce((x, y) => x + y, 0) / percents.length)}%` : "—",
          });
        }
        return {
          rows: rows.sort((a, b) => b.examId - a.examId || a.classId - b.classId),
          teachers: db.users.filter((u) => u.role === "tutor").map(person),
          classes: db.classes.map((c) => ({ id: c.id, label: batchOf(c) })),
        };
      }),
    );
  },
};
