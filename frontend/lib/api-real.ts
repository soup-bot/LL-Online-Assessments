/**
 * The student side of the API over HTTP, with the same functions and results as the mock in
 * `api.ts`, so no screen can tell the difference. The Laravel endpoints are listed at /docs/api.
 */

import type {
  AttemptState,
  ClockInfo,
  CoverData,
  ResultDetail,
  SaveAnswerPatch,
  StudentHome,
  StudentResults,
  SubmittedSummary,
  SyncInfo,
  ViolationOutcome,
} from "@/lib/api-types";
import { clearAuth, getStoredUser, request, storeAuth } from "@/lib/http";
import { readDb, setSessionUserId } from "@/lib/mock/db";
import type { User } from "@/lib/types";

/**
 * The teacher and admin screens are not connected to the API yet and still read the demo data
 * in the browser. Signing in as staff also signs into the matching demo account so they keep working.
 */
function bridgeToDemoData(user: User): void {
  const demo = user.role === "student" ? undefined : readDb().users.find((u) => u.email === user.email);
  setSessionUserId(demo?.id ?? null);
}

export const realAuth = {
  async login(email: string, password: string): Promise<User> {
    const { token, user } = await request<{ token: string; user: User }>("POST", "/auth/login", { email, password });
    storeAuth(token, user);
    bridgeToDemoData(user);
    return user;
  },

  logout(): void {
    // Tell the server to revoke the token, but never make the person wait for it.
    void request("POST", "/auth/logout").catch(() => undefined);
    clearAuth();
    setSessionUserId(null);
  },
};

export function currentStoredUser(): User | null {
  return getStoredUser();
}

/** The API sends null for "none"; the screens expect the field to be missing. */
const orUndefined = <T>(value: T | null): T | undefined => value ?? undefined;

export const realStudent = {
  async home(): Promise<StudentHome> {
    const data = await request<StudentHome>("GET", "/student/home");
    const fix = (c: StudentHome["open"][number]) => ({ ...c, attemptId: orUndefined(c.attemptId ?? null), deadlineAt: orUndefined(c.deadlineAt ?? null) });
    return { ...data, open: data.open.map(fix), inProgress: data.inProgress.map(fix) };
  },

  async cover(sessionId: number): Promise<CoverData> {
    const data = await request<CoverData>("GET", `/student/exams/${sessionId}/cover`);
    return { ...data, resumeAttemptId: orUndefined(data.resumeAttemptId ?? null) };
  },

  start(sessionId: number): Promise<{ attemptId: number }> {
    return request("POST", `/student/exams/${sessionId}/start`);
  },

  attempt(attemptId: number): Promise<AttemptState> {
    return request("GET", `/student/attempts/${attemptId}`);
  },

  clock(attemptId: number): Promise<ClockInfo> {
    return request("GET", `/student/attempts/${attemptId}/clock`);
  },

  /** `patch.at` is when the student made the edit, so a retry that arrives late can't overwrite newer typing. */
  saveAnswer(attemptId: number, questionId: number, patch: SaveAnswerPatch): Promise<SyncInfo> {
    const { at, ...fields } = patch;
    return request("PUT", `/student/attempts/${attemptId}/answers/${questionId}`, { ...fields, clientSavedAt: at ?? new Date().toISOString() });
  },

  recordViolation(attemptId: number, kind: "hidden" | "blur" = "hidden"): Promise<ViolationOutcome> {
    return request("POST", `/student/attempts/${attemptId}/violations`, { kind });
  },

  submit(attemptId: number, reason: "manual" | "timeout" = "manual"): Promise<SubmittedSummary> {
    return request("POST", `/student/attempts/${attemptId}/submit`, { reason });
  },

  submitted(attemptId: number): Promise<SubmittedSummary> {
    return request("GET", `/student/attempts/${attemptId}/submitted`);
  },

  results(): Promise<StudentResults> {
    return request("GET", "/student/results");
  },

  result(attemptId: number): Promise<ResultDetail> {
    return request("GET", `/student/results/${attemptId}`);
  },

  async dismissNewResult(attemptId: number): Promise<void> {
    await request("POST", `/student/results/${attemptId}/viewed`);
  },
};
