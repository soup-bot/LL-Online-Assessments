/**
 * Teacher and admin calls over HTTP. Lists are searched, filtered and paged by the server, so a screen
 * asks for one page at a time. The endpoints and their rules are documented at /docs/api.
 */

import { request } from "@/lib/http";
import type {
  AdminClass,
  AdminClassesData,
  AdminExamsData,
  AdminExamsQuery,
  ClassInput,
  EditorQuestion,
  ExamBuilder,
  ExamListQuery,
  ExamSessions,
  ExamSettingsPatch,
  ListQuery,
  LiveData,
  LiveQuery,
  MarkingData,
  QuestionDraft,
  SaveMarksInput,
  StudentSearchData,
  TeacherClass,
  ToMarkPage,
  TutorHome,
  UserInput,
  UserRow,
  UsersData,
  UsersQuery,
} from "@/lib/staff-types";
import type { QuestionKind } from "@/lib/types";

/** `?a=1&b=2`, leaving out anything empty. */
function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const paging = (q: ListQuery) => ({ q: q.q?.trim(), page: q.page, per_page: q.perPage });

export const tutorApi = {
  /** The teacher's exams: one page, already filtered, searched and sorted. Counts always cover every exam. */
  home(query: ExamListQuery = {}): Promise<TutorHome> {
    return request("GET", `/tutor/exams${qs({ ...paging(query), filter: query.filter, sort: query.sort, dir: query.dir })}`);
  },

  /** How many submissions wait for this teacher, for the header badge. */
  toMarkCount(): Promise<number> {
    return request("GET", "/tutor/to-mark/count");
  },

  toMark(query: ListQuery = {}): Promise<ToMarkPage> {
    return request("GET", `/tutor/to-mark${qs({ page: query.page, per_page: query.perPage })}`);
  },

  classes(): Promise<TeacherClass[]> {
    return request("GET", "/tutor/classes");
  },

  createExam(): Promise<{ examId: number }> {
    return request("POST", "/tutor/exams");
  },

  builder(examId: number): Promise<ExamBuilder> {
    return request("GET", `/tutor/exams/${examId}`);
  },

  async updateExam(examId: number, patch: ExamSettingsPatch): Promise<void> {
    await request("PATCH", `/tutor/exams/${examId}`, patch);
  },

  async publish(examId: number): Promise<void> {
    await request("POST", `/tutor/exams/${examId}/publish`);
  },

  /** The editor's view of a question, or a blank one of `kind` when `questionId` is null. */
  question(examId: number, questionId: number | null, kind: QuestionKind = "mcq"): Promise<EditorQuestion> {
    return questionId == null
      ? request("GET", `/tutor/exams/${examId}/questions/new${qs({ kind })}`)
      : request("GET", `/tutor/exams/${examId}/questions/${questionId}`);
  },

  saveQuestion(examId: number, questionId: number | null, draft: QuestionDraft): Promise<{ questionId: number }> {
    return questionId == null
      ? request("POST", `/tutor/exams/${examId}/questions`, draft)
      : request("PUT", `/tutor/exams/${examId}/questions/${questionId}`, draft);
  },

  async deleteQuestion(examId: number, questionId: number): Promise<void> {
    await request("DELETE", `/tutor/exams/${examId}/questions/${questionId}`);
  },

  async setApproved(examId: number, questionId: number, approved: boolean): Promise<void> {
    await request("PATCH", `/tutor/exams/${examId}/questions/${questionId}/approval`, { approved });
  },

  importQuestions(examId: number, drafts: QuestionDraft[]): Promise<{ added: number }> {
    return request("POST", `/tutor/exams/${examId}/questions/import`, { questions: drafts });
  },

  sessions(examId: number): Promise<ExamSessions> {
    return request("GET", `/tutor/exams/${examId}/sessions`);
  },

  /** Who is sitting, handed in or waiting in one class: searched, filtered and paged by the server. */
  live(sessionId: number, query: LiveQuery = {}): Promise<LiveData> {
    return request("GET", `/tutor/sessions/${sessionId}/live${qs({ ...paging(query), state: query.state === "all" ? undefined : query.state })}`);
  },

  async openSession(sessionId: number): Promise<void> {
    await request("POST", `/tutor/sessions/${sessionId}/open`);
  },

  /** Hands in anyone still sitting; says how many that was. */
  closeSession(sessionId: number): Promise<{ submitted: number }> {
    return request("POST", `/tutor/sessions/${sessionId}/close`);
  },

  async releaseResults(sessionId: number): Promise<void> {
    await request("POST", `/tutor/sessions/${sessionId}/release`);
  },

  attempt(attemptId: number): Promise<MarkingData> {
    return request("GET", `/tutor/attempts/${attemptId}`);
  },

  saveMarks(attemptId: number, input: SaveMarksInput): Promise<{ score: number; total: number; grade: string }> {
    return request("PUT", `/tutor/attempts/${attemptId}/marks`, input);
  },
};

export const adminApi = {
  users(query: UsersQuery = {}): Promise<UsersData> {
    return request("GET", `/admin/users${qs({ ...paging(query), role: query.role })}`);
  },

  /** Create (id null) or edit an account; answers with the saved row. */
  saveUser(id: number | null, input: UserInput): Promise<UserRow> {
    return id == null ? request("POST", "/admin/users", input) : request("PATCH", `/admin/users/${id}`, input);
  },

  classes(query: ListQuery = {}): Promise<AdminClassesData> {
    return request("GET", `/admin/classes${qs(paging(query))}`);
  },

  /** Create (id null) or edit a class and its whole roster; answers with the saved class. */
  saveClass(id: number | null, input: ClassInput): Promise<AdminClass> {
    return id == null ? request("POST", "/admin/classes", input) : request("PATCH", `/admin/classes/${id}`, input);
  },

  /** For the class screen's "Add a student" search. */
  students(query: ListQuery = {}): Promise<StudentSearchData> {
    return request("GET", `/admin/students${qs(paging(query))}`);
  },

  exams(query: AdminExamsQuery = {}): Promise<AdminExamsData> {
    return request("GET", `/admin/exams${qs({ ...paging(query), teacher: query.teacher, class: query.class, status: query.status })}`);
  },
};
