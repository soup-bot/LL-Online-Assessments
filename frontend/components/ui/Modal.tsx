"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, motion, useDragControls, useMotionValue, type PanInfo } from "motion/react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  /** "center" is a dialog card; "sheet" slides up from the bottom (phones) and can be swiped down. */
  variant?: "center" | "sheet";
  /** When false, Esc, the backdrop and swiping do nothing (for must-read warnings). */
  dismissible?: boolean;
  /** "alertdialog" for interruptions the student has to answer. */
  role?: "dialog" | "alertdialog";
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/** Past this drag distance (px) or flick speed (px/s) a released sheet closes. */
const CLOSE_DISTANCE = 70;
const CLOSE_VELOCITY = 350;

/**
 * Built on the native <dialog>: the browser handles the focus trap, Esc, and making the
 * page behind inert. We add the look, the "can't be dismissed" option, and for sheets a
 * grab handle that can be dragged down to dismiss.
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
  const y = useMotionValue(0);
  const dragControls = useDragControls();
  const sheet = variant === "sheet";

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    y.set(0);
    if (open && !el.open) {
      el.showModal();
      // Land focus on the safest control (or the title) instead of whichever comes first.
      el.querySelector<HTMLElement>("[data-autofocus]")?.focus({ preventScroll: true });
    }
    if (!open && el.open) el.close();
  }, [open, y]);

  function endDrag(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    if (info.offset.y > CLOSE_DISTANCE || info.velocity.y > CLOSE_VELOCITY) {
      void animate(y, window.innerHeight, { duration: 0.15, ease: "easeIn" }).then(() => onClose?.());
    } else {
      void animate(y, 0, { type: "spring", stiffness: 700, damping: 45 });
    }
  }

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={labelledBy}
      aria-modal="true"
      className={cn(
        "ll-dialog",
        sheet ? "ll-sheet fixed inset-x-0 bottom-0 top-auto m-0 w-full" : "m-auto w-[calc(100%-32px)] max-w-[540px]",
      )}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose?.();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) onClose?.();
      }}
    >
      {open &&
        (sheet ? (
          <motion.div
            style={{ y }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 1 }}
            onDragEnd={endDrag}
            className={cn("relative mx-auto max-h-[88dvh] max-w-xl overflow-y-auto overscroll-contain rounded-t-[32px] bg-white", className)}
          >
            {/* Grab handle: the only place a drag starts, so the list below still scrolls normally. */}
            <div
              onPointerDown={(e) => dismissible && dragControls.start(e)}
              className={cn("sticky top-0 z-10 flex h-9 touch-none items-end justify-center bg-white pb-2", dismissible && "cursor-grab active:cursor-grabbing")}
            >
              <span aria-hidden className="h-[5px] w-11 rounded-full bg-[#ddd7cd]" />
            </div>
            {children}
          </motion.div>
        ) : (
          <div className={cn("relative overflow-hidden rounded-[32px] bg-white", className)}>{children}</div>
        ))}
    </dialog>
  );
}
