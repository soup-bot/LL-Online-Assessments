"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  /** "center" is a dialog card; "sheet" slides up from the bottom (phones). */
  variant?: "center" | "sheet";
  /** When false, Esc and clicking the backdrop do nothing (for must-read warnings). */
  dismissible?: boolean;
  /** "alertdialog" for interruptions the student has to answer. */
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * Built on the native <dialog>: the browser handles the focus trap, Esc, and making the
 * page behind inert. We add the look and the "can't be dismissed" option.
 */
export function Modal({
  open,
  onClose,
  variant = "center",
  dismissible = true,
  role = "dialog",
  labelledBy,
  className,
  children,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      // Land focus on the safest control (or the title) instead of whichever comes first.
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    }
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={cn(
        "ll-dialog",
        variant === "sheet"
          ? "ll-sheet fixed inset-x-0 bottom-0 top-auto m-0 w-full"
          : "m-auto w-[calc(100%-32px)] max-w-[540px]",
      )}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose?.();
      }}
    >
      {open && (
        <div
          className={cn(
            "relative overflow-hidden bg-white",
            variant === "sheet" ? "mx-auto max-h-[88dvh] max-w-xl overflow-y-auto rounded-t-[32px]" : "rounded-[32px]",
            className,
          )}
        >
          {children}
        </div>
      )}
    </dialog>
  );
}
