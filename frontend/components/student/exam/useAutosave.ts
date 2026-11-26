"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, toApiError, type ApiError } from "@/lib/api";
import type { SaveAnswerPatch, SavedAnswer, SyncInfo } from "@/lib/api-types";
import { clearAttemptCache, updateCachedAnswers } from "@/lib/attempt-cache";
import type { Answers } from "@/components/student/exam/examStatus";

export type SaveStatus = "saved" | "saving" | "error";

interface Options {
  attemptId: number;
  initial: Record<number, SavedAnswer>;
  /** Called with the server clock after every successful save. */
  onSync: (info: SyncInfo) => void;
  /** Called when saving can never succeed (time up, already submitted, signed out). */
  onFatal: (error: ApiError) => void;
}

interface Pending {
  patch: SaveAnswerPatch;
  /** Bumped on every edit, so a save that finishes late never drops a newer change. */
  version: number;
}

const DEBOUNCE_MS = 700;
const FATAL = new Set(["expired", "conflict", "not_found", "unauthorized", "forbidden"]);

const storageKey = (attemptId: number) => `ll.pending.${attemptId}`;

function loadPending(attemptId: number): Record<number, SaveAnswerPatch> {
  try {
    return JSON.parse(localStorage.getItem(storageKey(attemptId)) ?? "{}") as Record<number, SaveAnswerPatch>;
  } catch {
    return {};
  }
}

/**
 * Autosave for one attempt.
 *
 * - Edits show instantly and are saved in the background (text is debounced).
 * - Unsaved edits are mirrored to localStorage, so a reload or a dropped connection loses nothing.
 * - A failed save retries with backoff, and immediately when the browser comes back online.
 */
export function useAutosave({ attemptId, initial, onSync, onFatal }: Options) {
  const pending = useRef(new Map<number, Pending>());
  const version = useRef(0);
  const running = useRef<Promise<boolean> | null>(null);
  const stopped = useRef(false);
  const debounce = useRef<number | undefined>(undefined);
  const retry = useRef<number | undefined>(undefined);
  const retryDelay = useRef(2000);
  const callbacks = useRef({ onSync, onFatal });
  const flushRef = useRef<() => Promise<boolean>>(() => Promise.resolve(true));

  useEffect(() => {
    callbacks.current = { onSync, onFatal };
  });

  const [answers, setAnswers] = useState<Answers>(() => {
    const merged: Answers = {};
    for (const [id, saved] of Object.entries(initial)) merged[Number(id)] = { ...saved };
    for (const [id, patch] of Object.entries(loadPending(attemptId))) {
      const qid = Number(id);
      merged[qid] = { response: merged[qid]?.response ?? null, flagged: merged[qid]?.flagged ?? false, ...patch };
      pending.current.set(qid, { patch, version: ++version.current });
    }
    return merged;
  });
  const [status, setStatus] = useState<SaveStatus>(() => (pending.current.size > 0 ? "saving" : "saved"));

  const persist = useCallback(() => {
    try {
      const obj: Record<number, SaveAnswerPatch> = {};
      pending.current.forEach((p, qid) => (obj[qid] = p.patch));
      if (Object.keys(obj).length === 0) localStorage.removeItem(storageKey(attemptId));
      else localStorage.setItem(storageKey(attemptId), JSON.stringify(obj));
    } catch {
      // storage blocked: saving to the server still works
    }
  }, [attemptId]);

  const scheduleRetry = useCallback(() => {
    window.clearTimeout(retry.current);
    retry.current = window.setTimeout(() => void flushRef.current(), retryDelay.current);
    retryDelay.current = Math.min(retryDelay.current * 2, 15000);
  }, []);

  const flush = useCallback((): Promise<boolean> => {
    if (running.current) return running.current;

    const job = (async (): Promise<boolean> => {
      try {
        while (pending.current.size > 0 && !stopped.current) {
          const [qid, entry] = pending.current.entries().next().value as [number, Pending];
          try {
            const info = await api.student.saveAnswer(attemptId, qid, entry.patch);
            callbacks.current.onSync(info);
          } catch (e) {
            const err = toApiError(e);
            if (err.code !== "validation") throw err;
            // an invalid answer can never be saved: drop it instead of retrying forever
          }
          if (pending.current.get(qid)?.version === entry.version) pending.current.delete(qid);
          persist();
          retryDelay.current = 2000;
        }
        if (!stopped.current) setStatus(pending.current.size === 0 ? "saved" : "saving");
        return pending.current.size === 0;
      } catch (e) {
        const err = toApiError(e);
        if (FATAL.has(err.code)) {
          stopped.current = true;
          callbacks.current.onFatal(err);
        } else {
          setStatus("error");
          scheduleRetry();
        }
        return false;
      } finally {
        running.current = null;
      }
    })();

    running.current = job;
    return job;
  }, [attemptId, persist, scheduleRetry]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const update = useCallback(
    (questionId: number, patch: SaveAnswerPatch, immediate: boolean) => {
      if (stopped.current) return;
      setAnswers((prev) => ({
        ...prev,
        [questionId]: { response: prev[questionId]?.response ?? null, flagged: prev[questionId]?.flagged ?? false, ...patch },
      }));
      const existing = pending.current.get(questionId);
      pending.current.set(questionId, { patch: { ...existing?.patch, ...patch }, version: ++version.current });
      persist();
      setStatus("saving");
      window.clearTimeout(debounce.current);
      debounce.current = window.setTimeout(() => void flush(), immediate ? 0 : DEBOUNCE_MS);
    },
    [flush, persist],
  );

  const setResponse = useCallback(
    (questionId: number, response: string | null, immediate = false) => update(questionId, { response }, immediate),
    [update],
  );

  const toggleFlag = useCallback(
    (questionId: number, flagged: boolean) => update(questionId, { flagged }, true),
    [update],
  );

  /** Push everything out now (before submitting). True when nothing is left unsaved. */
  const flushNow = useCallback(async (): Promise<boolean> => {
    window.clearTimeout(debounce.current);
    for (let i = 0; i < 3 && pending.current.size > 0; i++) {
      if (!(await flush()) && pending.current.size > 0) break;
    }
    return pending.current.size === 0;
  }, [flush]);

  /** Stop saving and forget local copies (after the exam is handed in). */
  const finish = useCallback(() => {
    stopped.current = true;
    window.clearTimeout(debounce.current);
    window.clearTimeout(retry.current);
    pending.current.clear();
    persist();
    clearAttemptCache(attemptId);
  }, [persist, attemptId]);

  // Keep the on-device copy of the exam current, so a reload without a connection shows everything.
  useEffect(() => {
    if (!stopped.current) updateCachedAnswers(attemptId, answers);
  }, [attemptId, answers]);

  useEffect(() => {
    if (pending.current.size > 0) void flush();
    const onOnline = () => {
      retryDelay.current = 2000;
      if (pending.current.size > 0) void flush();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearTimeout(debounce.current);
      window.clearTimeout(retry.current);
    };
  }, [flush]);

  return { answers, status, setResponse, toggleFlag, flushNow, retryNow: flush, finish };
}
