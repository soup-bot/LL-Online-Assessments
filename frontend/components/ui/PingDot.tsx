import { cn } from "@/lib/utils";

/**
 * A small dot with a ring that pulses out of it ("live"). `className` sets the size, `color` the fill (a bg-* class).
 * The pulse is switched off for people who have asked their system for reduced motion.
 */
export function PingDot({ color = "bg-mint-ink", className = "size-[7px]" }: { color?: string; className?: string }) {
  return (
    <span aria-hidden className={cn("relative inline-grid shrink-0 place-items-center", className)}>
      <span className={cn("absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping", color)} />
      <span className={cn("relative size-full rounded-full", color)} />
    </span>
  );
}
