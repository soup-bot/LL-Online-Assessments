import type { AttemptState, SavedAnswer } from "@/lib/api-types";

/**
 * A copy of the running exam kept on the device, so reloading the page without a connection
 * still brings the questions and the student's answers back. It never contains the answer key
 * (the API doesn't send one). It is removed as soon as the exam is handed in.
 */

const key = (attemptId: number) => `ll.attempt.${attemptId}`;

interface Cached {
  state: AttemptState;
  /** Device time when it was stored, used to roll the clock forward while offline. */
  cachedAt: number;
}

function read(attemptId: number): Cached | null {
  try {
    const raw = localStorage.getItem(key(attemptId));
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

function write(attemptId: number, cached: Cached): void {
  try {
    localStorage.setItem(key(attemptId), JSON.stringify(cached));
  } catch {
    // storage full or blocked: the exam still works online
  }
}

export function saveAttemptCache(state: AttemptState): void {
  write(state.attemptId, { state, cachedAt: Date.now() });
}

/** Keep the stored answers in step with what the student has typed. No-op if nothing is cached. */
export function updateCachedAnswers(attemptId: number, answers: Record<number, SavedAnswer>): void {
  const cached = read(attemptId);
  if (cached) write(attemptId, { ...cached, state: { ...cached.state, answers } });
}

export function clearAttemptCache(attemptId: number): void {
  try {
    localStorage.removeItem(key(attemptId));
  } catch {
    // ignore
  }
}

/** The stored exam, with the server clock rolled forward by the time that has passed since. */
export function loadAttemptCache(attemptId: number): AttemptState | null {
  const cached = read(attemptId);
  if (!cached) return null;
  const elapsed = Date.now() - cached.cachedAt;
  return { ...cached.state, serverNow: new Date(Date.parse(cached.state.serverNow) + elapsed).toISOString() };
}
