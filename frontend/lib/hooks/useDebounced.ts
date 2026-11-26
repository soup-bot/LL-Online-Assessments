"use client";

import { useEffect, useState } from "react";

/** A value that follows `value` after it has stopped changing for `ms`. Used so typing in a search box asks the server once, not on every key. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}
