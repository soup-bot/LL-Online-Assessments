"use client";

import { useId, useState, type ReactNode, type SelectHTMLAttributes } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, Chip, Modal } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

/** "← My exams": a roomy back link above a page title. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-ml-1 flex min-h-11 items-center gap-1.5 self-start rounded-full px-1 text-[15px] font-extrabold no-underline">
      <ArrowLeft className="size-[18px]" strokeWidth={2.8} aria-hidden />
      {children}
    </Link>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] font-black leading-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="text-[15px] font-bold text-muted md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  );
}

/** Rotated icon tile, the design's signature accent. */
export function TiltTile({ children, tone, className }: { children: ReactNode; tone: string; className?: string }) {
  return <span className={cn("grid shrink-0 -rotate-5 place-items-center", tone, className)}>{children}</span>;
}

/** A label wrapped around one control. */
export function Field({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1.5 text-sm font-extrabold", className)}>
      {label}
      {children}
      {hint && <span className="text-xs font-bold text-muted">{hint}</span>}
    </label>
  );
}

const control =
  "w-full border-2 border-line-input bg-white font-bold outline-none transition placeholder:font-medium placeholder:text-subtle focus:border-secondary focus:ring-4 focus:ring-secondary-ring disabled:bg-paper disabled:text-muted";

/** Input class for forms on staff screens (rounded box, a little smaller than the pill sign-in input). */
export const inputClass = cn(control, "h-12 rounded-2xl px-4 text-[15px]");
export const textareaClass = cn(control, "resize-y rounded-2xl px-4 py-3 text-[15px] font-semibold leading-relaxed");

const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235e6372' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")";

export function Select({ className, children, style, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(control, "h-12 appearance-none rounded-2xl bg-[length:16px] bg-[right_14px_center] bg-no-repeat px-4 pr-10 text-[15px]", className)}
      style={{ backgroundImage: CHEVRON, ...style }}
      {...rest}
    >
      {children}
    </select>
  );
}

/** Filter pill: dark when selected, outlined otherwise. */
export function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-10 rounded-full px-4 text-sm font-extrabold transition",
        active ? "bg-ink text-white" : "border-2 border-line-input bg-white text-ink hover:bg-paper",
      )}
    >
      {children}
    </button>
  );
}

/** Label above a thin progress bar, as used on exam cards. */
export function MiniProgress({ label, value, tone = "bg-secondary" }: { label: string; value: number | null; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-extrabold text-muted">{label}</span>
      <div className="h-2 rounded-full bg-chip">
        {value != null && value > 0 && (
          <div className={cn("h-2 rounded-full transition-[width] duration-500", tone)} style={{ width: `${Math.min(100, value)}%` }} />
        )}
      </div>
    </div>
  );
}

export function StatusChip({ tone, dot, children }: { tone: ChipTone; dot?: string; children: ReactNode }) {
  return (
    <Chip tone={tone} size="md" className="whitespace-nowrap">
      {dot && <span aria-hidden className={cn("size-[7px] rounded-full", dot)} />}
      {children}
    </Chip>
  );
}

/** Asks before something that can't be taken back. */
export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  tone = "primary",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "dark";
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} dismissible={!busy} role="alertdialog" labelledBy={id}>
      <div className="flex flex-col gap-4 p-6 md:p-7">
        <h2 id={id} className="text-[22px] font-black leading-tight">
          {title}
        </h2>
        <div className="text-[15px] font-semibold leading-relaxed text-ink-2">{children}</div>
        <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
          <Button variant="secondary" size="md" onClick={onClose} disabled={busy} data-autofocus>
            Cancel
          </Button>
          <Button variant={tone} size="md" onClick={() => void confirm()} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Page numbers to show: the first, the last and the neighbours of the current page, with gaps as null. */
function pageWindow(current: number, pages: number): (number | null)[] {
  const wanted = new Set([0, pages - 1, current - 1, current, current + 1]);
  const list = [...wanted].filter((p) => p >= 0 && p < pages).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  list.forEach((p, i) => {
    if (i > 0 && p - list[i - 1] > 1) out.push(null);
    out.push(p);
  });
  return out;
}

/** "Showing 11–20 of 35", rows per page, and previous / numbered / next buttons. `page` starts at 0. */
export function Pagination({
  total,
  page,
  pageSize,
  sizes = [10, 25, 50],
  onPage,
  onPageSize,
  className,
}: {
  total: number;
  page: number;
  pageSize: number;
  sizes?: number[];
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  className?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages - 1);
  const from = total === 0 ? 0 : current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);
  const btn = "grid h-9 min-w-9 place-items-center rounded-full px-2 text-sm font-extrabold transition disabled:pointer-events-none disabled:opacity-40";

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-x-6 gap-y-3", className)}>
      <span className="text-sm font-bold text-muted">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="flex items-center gap-2 text-sm font-bold text-muted">
          Rows per page
          <Select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-9 w-auto! rounded-full py-0 pl-3.5 pr-9 text-sm"
            aria-label="Rows per page"
          >
            {sizes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </label>
        <nav aria-label="Pages" className="flex items-center gap-1">
          <button type="button" className={cn(btn, "hover:bg-chip")} disabled={current === 0} onClick={() => onPage(current - 1)} aria-label="Previous page">
            <ChevronLeft className="size-4" strokeWidth={3} aria-hidden />
          </button>
          {pageWindow(current, pages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} aria-hidden className="px-1 text-sm font-extrabold text-subtle">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-label={`Page ${p + 1}`}
                aria-current={p === current ? "page" : undefined}
                className={cn(btn, p === current ? "bg-secondary text-white" : "hover:bg-chip")}
              >
                {p + 1}
              </button>
            ),
          )}
          <button type="button" className={cn(btn, "hover:bg-chip")} disabled={current >= pages - 1} onClick={() => onPage(current + 1)} aria-label="Next page">
            <ChevronRight className="size-4" strokeWidth={3} aria-hidden />
          </button>
        </nav>
      </div>
    </div>
  );
}
