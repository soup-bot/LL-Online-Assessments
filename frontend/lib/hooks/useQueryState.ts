"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDebounced } from "@/lib/hooks/useDebounced";

type Value = string | number;

/**
 * Keeps a list screen's filters, search, sort and page in the address bar (`?filter=drafts&page=3`), so a
 * refresh keeps your place, the back button steps through your filters, and a link opens the same view.
 * The values equal the defaults when the address has nothing for them, and a default is never written
 * to the address, so a fresh page has a clean URL. Any change other than the page itself sends you back to page 1.
 *
 * Pages that use this need a <Suspense> boundary above them (Next.js requires it for useSearchParams).
 */
export function useQueryState<T extends Record<string, Value>>(defaults: T) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const values = {} as Record<string, Value>;
  for (const [key, fallback] of Object.entries(defaults)) {
    const raw = search.get(key);
    if (raw === null || raw === "") {
      values[key] = fallback;
    } else if (typeof fallback === "number") {
      const n = Math.trunc(Number(raw));
      values[key] = Number.isFinite(n) && n >= 0 ? n : fallback;
    } else {
      values[key] = raw;
    }
  }

  const update = useCallback(
    (patch: Partial<T>, mode: "push" | "replace" = "push") => {
      const next = new URLSearchParams(search.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === defaults[key]) next.delete(key);
        else next.set(key, String(value));
      }
      if (!("page" in patch) && Object.keys(patch).length > 0) next.delete("page");
      const query = next.toString();
      router[mode](`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    },
    // `defaults` is a fresh object each render; its values never change for a given screen
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname, router, search],
  );

  return [values as T, update] as const;
}

/**
 * A search box that waits for you to stop typing, then writes the text into the address. If the address
 * changes some other way (the back button), the box follows it.
 */
export function useSearchText(urlValue: string, commit: (value: string) => void, ms = 300) {
  const [text, setText] = useState(urlValue);
  const debounced = useDebounced(text.trim(), ms);
  const pushed = useRef(urlValue);
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });

  useEffect(() => {
    if (debounced !== pushed.current) {
      pushed.current = debounced;
      commitRef.current(debounced);
    }
  }, [debounced]);

  useEffect(() => {
    if (urlValue !== pushed.current) {
      pushed.current = urlValue;
      setText(urlValue);
    }
  }, [urlValue]);

  return [text, setText] as const;
}

/** If the address asks for a page past the end (a stale link, or a filter that now has fewer rows), go to page 1. */
export function useClampPage(total: number | undefined, page: number, size: number, toFirst: () => void) {
  const toFirstRef = useRef(toFirst);
  useEffect(() => {
    toFirstRef.current = toFirst;
  });
  useEffect(() => {
    if (total !== undefined && total > 0 && page > 1 && (page - 1) * size >= total) toFirstRef.current();
  }, [total, page, size]);
}
