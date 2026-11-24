import Image from "next/image";
import type { Grade } from "@/lib/grading";
import { KIND_META } from "@/lib/question-kinds";
import type { QuestionKind } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Logo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/full-logo.svg"
      alt="Limitless Learning"
      width={331}
      height={108}
      priority={priority}
      className={cn("h-10 w-auto", className)}
    />
  );
}

const gradeSizes = {
  sm: "size-11 rounded-[14px] text-xl -rotate-4",
  md: "size-[52px] rounded-[17px] text-[26px] -rotate-6",
  lg: "size-[78px] rounded-[26px] text-[42px] -rotate-6",
  xl: "size-[120px] rounded-[36px] text-[64px] -rotate-6",
} as const;

/** The rotated grade tile. */
export function GradeTile({
  grade,
  size = "md",
  tone = "solid",
  className,
}: {
  grade: Grade;
  size?: keyof typeof gradeSizes;
  tone?: "solid" | "tint";
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={`Grade ${grade}`}
      className={cn(
        "grid shrink-0 place-items-center font-black leading-none",
        gradeSizes[size],
        tone === "solid" ? "bg-brand text-white" : "bg-brand-tint text-brand-dark",
        className,
      )}
    >
      {grade}
    </span>
  );
}

/** Rounded progress track. `ticks` marks grade boundaries. */
export function ProgressBar({
  value,
  ticks,
  className,
  barClassName,
  label,
}: {
  value: number;
  ticks?: number[];
  className?: string;
  barClassName?: string;
  label?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={cn("relative h-3 rounded-full bg-chip", className)}
    >
      <div className={cn("h-full rounded-full bg-brand transition-[width] duration-500", barClassName)} style={{ width: `${pct}%` }} />
      {ticks?.map((t) => (
        <span key={t} aria-hidden className="absolute -top-[3px] h-[calc(100%+6px)] w-0.5 bg-[#c9c3b8]" style={{ left: `${t}%` }} />
      ))}
    </div>
  );
}

/** Rotated tile showing a question's kind. Pass a number to show "Q3" style labels instead. */
export function KindBadge({
  kind,
  label,
  className,
}: {
  kind: QuestionKind;
  label?: string;
  className?: string;
}) {
  const meta = KIND_META[kind];
  return (
    <span className={cn("grid place-items-center font-black", meta.bg, meta.fg, className)}>{label ?? meta.badge}</span>
  );
}
