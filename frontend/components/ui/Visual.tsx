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

/** Faint drawing in a tile's corner, behind the text (same treatment as the exam cover tiles). */
export function TileWatermark({ src }: { src: string }) {
  return (
    <Image
      src={src}
      alt=""
      width={256}
      height={256}
      aria-hidden
      className="pointer-events-none absolute -bottom-4 -right-3 size-24 opacity-25"
    />
  );
}

/** The shield on its own, without the "Limitless Learning" wording. */
export function LogoMark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return <Image src="/logo.svg" alt="Limitless Learning" width={82} height={108} priority={priority} className={cn("h-10 w-auto", className)} />;
}

const gradeSizes = {
  sm: "size-11 text-xl -rotate-4",
  md: "size-[52px] text-[26px] -rotate-6",
  lg: "size-[78px] text-[42px] -rotate-6",
  xl: "size-[120px] text-[64px] -rotate-6",
} as const;

/** One colour per grade: saturated for the solid medal, pastel for the tint one. */
const gradeTones: Record<Grade, { solid: string; tint: string }> = {
  A: { solid: "bg-brand text-white", tint: "bg-mint text-mint-deep" },
  B: { solid: "bg-sky-ink text-white", tint: "bg-sky text-sky-deep" },
  C: { solid: "bg-[#c27d0a] text-white", tint: "bg-amber text-amber-ink" },
  D: { solid: "bg-peach-bar text-white", tint: "bg-peach text-peach-ink" },
  U: { solid: "bg-[#d93a2b] text-white", tint: "bg-rose text-rose-ink" },
};

/** Background class of a grade's solid colour, for bars and accents that should match its medal. */
export const gradeBg = (grade: Grade) => gradeTones[grade].solid.split(" ")[0];

/** Pastel background class of a grade. */
export const gradeTintBg = (grade: Grade) => gradeTones[grade].tint.split(" ")[0];

/** The grade as a scalloped medal, tilted, in its own colour. */
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
        "rosette relative grid shrink-0 place-items-center font-black leading-none",
        tone === "solid" && "rosette-squiggle",
        gradeSizes[size],
        gradeTones[grade][tone],
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
      <div className={cn("h-full rounded-full bg-secondary transition-[width] duration-500", barClassName)} style={{ width: `${pct}%` }} />
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
