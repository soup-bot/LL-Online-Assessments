"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SyncInfo } from "@/lib/api-types";

/**
 * Countdown that trusts the server, not the device. It remembers the server time at the
 * last sync and advances it by the time that has passed since. Two device clocks measure that:
 * `performance.now()` can't be changed by the student but may stop while a phone sleeps, and
 * `Date.now()` keeps going through sleep but can be changed. Taking the larger of the two means
 * neither sleeping nor setting the clock back can buy extra time. The screen also re-syncs with
 * the server whenever the student comes back, which corrects any remaining difference.
 */
export function useServerClock(initial: SyncInfo) {
  const anchor = useRef({
    serverMs: Date.parse(initial.serverNow),
    perfMs: performance.now(),
    wallMs: Date.now(),
    deadlineMs: Date.parse(initial.deadlineAt),
  });

  const compute = useCallback(() => {
    const a = anchor.current;
    const elapsed = Math.max(performance.now() - a.perfMs, Date.now() - a.wallMs);
    return a.deadlineMs - (a.serverMs + elapsed);
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
        wallMs: Date.now(),
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
