import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones = {
  brand: "bg-brand-tint text-brand-dark",
  mint: "bg-mint text-mint-deep",
  sky: "bg-sky text-sky-deep",
  lilac: "bg-lilac text-lilac-ink",
  peach: "bg-peach text-peach-ink",
  amber: "bg-amber text-amber-ink",
  rose: "bg-rose text-rose-ink",
  neutral: "bg-chip text-ink-2",
  white: "bg-white text-ink-2",
} as const;

const sizes = {
  sm: "px-2.5 py-[3px] text-[11px]",
  md: "px-3 py-1 text-xs",
  lg: "px-3.5 py-1.5 text-[13px]",
} as const;

export type ChipTone = keyof typeof tones;

/** Small rounded label. Tone colours are the design's pastel pairs. */
export function Chip({
  tone = "neutral",
  size = "md",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone; size?: keyof typeof sizes }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full font-black", tones[tone], sizes[size], className)}
      {...rest}
    />
  );
}
