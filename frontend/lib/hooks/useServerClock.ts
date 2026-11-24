"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SyncInfo } from "@/lib/api-types";

/**
 * Countdown that trusts the server, not the device. It remembers the server time at the
 * last sync and advances it with `performance.now()`, which keeps counting steadily even
 * if the student changes the phone's clock. Reloading re-syncs from the server's answer.
 */
export function useServerClock(initial: SyncInfo) {
  const anchor = useRef({
    serverMs: Date.parse(initial.serverNow),
    perfMs: performance.now(),
    deadlineMs: Date.parse(initial.deadlineAt),
  });

  const compute = useCallback(() => {
    const a = anchor.current;
    const serverNow = a.serverMs + (performance.now() - a.perfMs);
    return a.deadlineMs - serverNow;
  }, []);

  const [remainingMs, setRemainingMs] = useState(compute);

  useEffect(() => {
    const id = window.setInterval(() => setRemainingMs(compute()), 250);
    return () => window.clearInterval(id);
  }, [compute]);

  /** Call with every server response that carries the clock. */
  const sync = useCallback(
    (info: SyncInfo) => {
      anchor.current = {
        serverMs: Date.parse(info.serverNow),
        perfMs: performance.now(),
        deadlineMs: Date.parse(info.deadlineAt),
      };
      setRemainingMs(compute());
    },
    [compute],
  );

  return {
    remainingMs,
    /** Whole seconds left, rounded up so the display reads 00:01 until time is truly out. */
    remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
    expired: remainingMs <= 0,
    sync,
  };
}
