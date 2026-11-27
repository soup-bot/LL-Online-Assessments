"use client";

import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { toApiError, type ApiError } from "@/lib/api";
import { DEMO_CHANGED_EVENT } from "@/lib/demo-events";

interface AsyncState<T> {
  data: T | null;
  error: ApiError | null;
  /** True only for the first load or a hard reload; background refreshes keep the old data on screen. */
  loading: boolean;
}

/**
 * Minimal data hook: loading, error and reload in one place, so every screen handles
 * them the same way. `refresh()` refetches quietly; `reload()` shows the skeleton again.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList, options: { initial?: T | null } = {}) {
  // `initial` is something already known (a copy from a moment ago): show it at once and refresh quietly,
  // for the first load only. Later changes to `deps` load normally.
  const initial = useRef(options.initial ?? null);
  const [state, setState] = useState<AsyncState<T>>({ data: initial.current, error: null, loading: initial.current === null });
  const fnRef = useRef(fn);
  const runId = useRef(0);

  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (quiet: boolean) => {
    const id = ++runId.current;
    if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === runId.current) setState({ data, error: null, loading: false });
    } catch (e) {
      // keep showing stale data on a failed quiet refresh
      if (id === runId.current) setState((s) => ({ data: quiet ? s.data : null, error: quiet ? s.error : toApiError(e), loading: false }));
    }
  }, []);

  useEffect(() => {
    // Cleared only once the first load settles: in development React runs this effect twice at start-up,
    // and the second run must stay quiet too.
    const quiet = initial.current !== null;
    void run(quiet).then(() => {
      initial.current = null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const onDemo = () => void run(true);
    window.addEventListener(DEMO_CHANGED_EVENT, onDemo);
    return () => window.removeEventListener(DEMO_CHANGED_EVENT, onDemo);
  }, [run]);

  return {
    ...state,
    reload: useCallback(() => run(false), [run]),
    refresh: useCallback(() => run(true), [run]),
  };
}
