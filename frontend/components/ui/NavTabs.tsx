"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavTab {
  id: string;
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Small trailing element, e.g. a count. */
  badge?: ReactNode;
}

/**
 * Top navigation: an icon and label per tab. The violet underline slides from one tab
 * to the next, and an inactive tab's icon gives a small tilt on hover.
 */
export function NavTabs({ tabs, active, className }: { tabs: readonly NavTab[]; active?: string; className?: string }) {
  const group = useId();
  return (
    <nav aria-label="Main" className={cn("flex gap-1.5", className)}>
      {tabs.map(({ id, href, label, Icon, badge }) => {
        const on = active === id;
        return (
          <Link
            key={id}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "group relative flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-sm no-underline md:flex-none md:justify-start md:gap-2 md:px-4 md:text-base transition-colors active:scale-95",
              on ? "font-extrabold text-secondary-dark hover:text-secondary-dark" : "font-bold text-ink-2 hover:bg-chip hover:text-ink",
            )}
          >
            {on && (
              <motion.span
                layoutId={`nav-pill-${group}`}
                aria-hidden
                className="absolute inset-x-3 -bottom-1 h-[3px] rounded-full bg-secondary"
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
              />
            )}
            <Icon
              aria-hidden
              strokeWidth={on ? 2.8 : 2.2}
              className={cn("relative hidden size-[18px] transition-transform min-[380px]:block duration-150", !on && "group-hover:-rotate-12 group-hover:scale-110")}
            />
            <span className="relative">{label}</span>
            {badge && <span className="relative">{badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
