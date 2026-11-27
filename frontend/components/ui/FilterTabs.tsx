import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The grey track that holds a row of FilterPills: one segmented control, "pick one". */
export function FilterTabs({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full flex-wrap gap-1 rounded-[22px] bg-chip p-1", className)}>
      {children}
    </div>
  );
}

/** One segment of a FilterTabs track: a white chip with a soft shadow when selected, plain text otherwise. */
export function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 whitespace-nowrap rounded-full px-4 text-sm transition",
        active ? "bg-white font-black text-ink shadow-[0_1px_3px_rgba(20,20,40,0.14)]" : "font-extrabold text-muted hover:bg-white/60 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
