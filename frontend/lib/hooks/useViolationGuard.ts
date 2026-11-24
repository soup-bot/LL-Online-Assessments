"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `onViolation` once each time the student leaves the exam: switching tab, switching
 * app, or clicking out of the window. Tab switches fire both `blur` and `visibilitychange`,
 * so an `away` flag makes sure one departure is only counted once; it clears on return.
 */
export function useViolationGuard(enabled: boolean, onViolation: (kind: "hidden" | "blur") => void) {
  const handler = useRef(onViolation);

  useEffect(() => {
    handler.current = onViolation;
  });

  useEffect(() => {
    if (!enabled) return;
    let away = false;

    const leave = (kind: "hidden" | "blur") => {
      if (away) return;
      away = true;
      handler.current(kind);
    };
    const back = () => {
      away = false;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") leave("hidden");
      else if (document.hasFocus()) back();
    };
    const onBlur = () => leave("blur");
    const onFocus = () => {
      if (document.visibilityState === "visible") back();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled]);
}
