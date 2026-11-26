"use client";

import { useEffect } from "react";

/** A software keyboard takes at least this many px off the visible height. */
const KEYBOARD_MIN_PX = 120;

function isTextField(el: EventTarget | null): boolean {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Mobile browsers can leave a `position: fixed` bar un-tappable after the keyboard closes:
 * it looks right but its tap area is stale until the page scrolls. We spot the keyboard closing
 * (the visual viewport growing back, or a text box losing focus) and nudge the scroll by a pixel
 * and back, which makes the browser recompute where everything can be tapped.
 */
export function useKeyboardNudge() {
  useEffect(() => {
    const viewport = window.visualViewport;
    let keyboardOpen = false;
    let pending: number | undefined;

    const nudge = () => {
      window.cancelAnimationFrame(pending ?? 0);
      pending = window.requestAnimationFrame(() => {
        const y = window.scrollY;
        window.scrollTo(0, y > 0 ? y - 1 : y + 1);
        void document.body.offsetHeight; // force a layout pass between the two moves
        window.scrollTo(0, y);
      });
    };

    const onViewportResize = () => {
      if (!viewport) return;
      const shrunk = window.innerHeight - viewport.height > KEYBOARD_MIN_PX;
      if (shrunk) {
        keyboardOpen = true;
      } else if (keyboardOpen) {
        keyboardOpen = false;
        nudge();
      }
    };

    // Fallback for browsers that don't resize the visual viewport for the keyboard.
    const onFocusOut = (e: FocusEvent) => {
      if (isTextField(e.target)) window.setTimeout(nudge, 300);
    };

    viewport?.addEventListener("resize", onViewportResize);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      viewport?.removeEventListener("resize", onViewportResize);
      document.removeEventListener("focusout", onFocusOut);
      window.cancelAnimationFrame(pending ?? 0);
    };
  }, []);
}
