"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastState {
  id: number;
  text: string;
  tone: "success" | "error";
}

const ToastContext = createContext<((text: string, tone?: ToastState["tone"]) => void) | null>(null);

/** A short confirmation at the bottom of the screen ("Saved", "Results released"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((text: string, tone: ToastState["tone"] = "success") => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setToast(null), tone === "error" ? 5000 : 2600);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ y: 24, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 12, opacity: 0 }}
              transition={{ type: "spring", stiffness: 520, damping: 34 }}
              className={cn(
                "pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-5 py-3 text-sm font-black shadow-lg",
                toast.tone === "success" ? "bg-ink text-white" : "bg-rose text-rose-ink",
              )}
            >
              {toast.tone === "success" ? <CircleCheck className="size-5 text-[#6fe0a6]" aria-hidden /> : <CircleAlert className="size-5" aria-hidden />}
              {toast.text}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast must be used inside ToastProvider");
  return show;
}
