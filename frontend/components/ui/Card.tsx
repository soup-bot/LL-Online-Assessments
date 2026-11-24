import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** White rounded surface with the design's warm hairline border. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return <section className={cn("relative overflow-hidden rounded-[28px] border border-line bg-white", className)} {...rest} />;
}
