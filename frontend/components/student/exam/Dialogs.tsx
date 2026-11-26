"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { MonitorX, Timer, WifiOff } from "lucide-react";
import { cn, formatClock } from "@/lib/utils";
import type { Tally } from "@/components/student/exam/examStatus";
import { Button, Modal, Notice, Spinner } from "@/components/ui";

function IconTile({ tone, children }: { tone: string; children: ReactNode }) {
  return (
    <span className={cn("grid size-[52px] -rotate-6 place-items-center rounded-[18px] md:size-[60px] md:rounded-[20px]", tone)}>
      {children}
    </span>
  );
}

const list = (label: string, value: string, tone: string) => (
  <li key={label} className={cn("flex items-start justify-between gap-3 rounded-2xl px-3.5 py-3 text-sm font-extrabold md:rounded-[18px] md:px-4 md:text-[15px]", tone)}>
    <span className="shrink-0">{label}</span>
    <span className="min-w-0 text-right">{value}</span>
  </li>
);

/**
 * Compact list of question numbers: runs of 3+ become ranges ("Q2-Q8") and anything past the
 * first few shows as "+N more", so a 100-question exam can never overflow the dialog.
 */
function positions(nums: number[], maxShown = 4): string {
  const sorted = [...nums].sort((a, b) => a - b);
  const groups: number[][] = [];
  for (const n of sorted) {
    const last = groups[groups.length - 1];
    if (last && n === last[last.length - 1] + 1) last.push(n);
    else groups.push([n]);
  }
  const parts: { text: string; count: number }[] = [];
  for (const g of groups) {
    if (g.length >= 3) parts.push({ text: `Q${g[0]}\u2013Q${g[g.length - 1]}`, count: g.length });
    else g.forEach((n) => parts.push({ text: `Q${n}`, count: 1 }));
  }
  const shown = parts.slice(0, maxShown);
  const hidden = parts.slice(maxShown).reduce((sum, p) => sum + p.count, 0);
  return shown.map((p) => p.text).join(", ") + (hidden > 0 ? ` +${hidden} more` : "");
}

/** "Submit your exam?" with a summary of what is and isn't done. */
export function ConfirmDialog({
  open,
  onClose,
  onSubmit,
  tally,
  remainingSec,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  tally: Tally;
  remainingSec: number;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <Modal
      open={open}
      onClose={submitting ? undefined : onClose}
      dismissible={!submitting}
      role="alertdialog"
      labelledBy="confirm-title"
      className="max-h-[88dvh] overflow-y-auto"
    >
      <div className="flex flex-col gap-4 p-6 md:gap-5 md:p-[34px]">
        <IconTile tone="bg-brand text-white">
          <Image src="/submit-white.png" alt="" width={256} height={256} aria-hidden className="size-9 md:size-10" />
        </IconTile>
        <div className="flex flex-col gap-1.5">
          <h2 id="confirm-title" className="text-2xl font-black md:text-[28px]">
            Submit your exam?
          </h2>
          <p className="text-[15px] font-semibold leading-normal text-ink-2 md:text-base">
            Once it&apos;s in, you can&apos;t change your answers. You still have{" "}
            <span className="font-black tabular-nums">{formatClock(remainingSec)}</span> left if you want another look.
          </p>
        </div>
        <ul className="flex flex-col gap-1.5 md:gap-2">
          {list("Answered", `${tally.answered} of ${tally.total}`, "bg-brand-soft [&>span:last-child]:text-brand-dark")}
          {tally.flagged.length > 0 && list("Marked to come back to", positions(tally.flagged), "bg-amber text-amber-ink")}
          {tally.empty.length > 0 && list("Not answered", positions(tally.empty), "bg-chip")}
        </ul>
        {error && <Notice variant="error">{error}</Notice>}
        <div className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-2.5">
          <Button onClick={onSubmit} loading={submitting} className="md:order-2">
            {submitting ? "Submitting…" : "Yes, submit"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={submitting} data-autofocus className="md:order-1">
            Take another look
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Shown on return after the student left the exam window. Can't be dismissed by Esc. */
export function ViolationDialog({
  open,
  count,
  max,
  onClose,
}: {
  open: boolean;
  count: number;
  max: number;
  onClose: () => void;
}) {
  const shown = Math.min(count, max);
  return (
    <Modal open={open} dismissible={false} role="alertdialog" labelledBy="warn-title">
      <div className="flex flex-col gap-4 p-6 md:gap-5 md:p-[34px]">
        <IconTile tone="bg-peach-mid text-peach-ink">
          <MonitorX className="size-6 md:size-7" strokeWidth={2.2} aria-hidden />
        </IconTile>
        <div className="flex flex-col gap-1.5">
          <h2 id="warn-title" className="text-2xl font-black md:text-[28px]">
            You left the exam window
          </h2>
          <p className="text-[15px] font-semibold leading-normal text-ink-2 md:text-base">
            That&apos;s been noted and your teacher can see it. Your timer kept running, so let&apos;s get you back to it.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[20px] bg-peach-soft p-3.5 md:rounded-[22px] md:p-[18px]">
          <div className="flex justify-between text-sm font-black text-peach-deep md:text-[15px]">
            <span>Times you&apos;ve left</span>
            <span>
              {shown} of {max}
            </span>
          </div>
          <div className="grid gap-1.5 md:gap-2" style={{ gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))` }} aria-hidden>
            {Array.from({ length: max }, (_, i) => (
              <span key={i} className={cn("h-2.5 rounded-full md:h-3", i < shown ? "bg-peach-bar" : "bg-peach-mid")} />
            ))}
          </div>
          <p className="text-[13px] font-bold text-peach-text md:text-sm">On the {ordinal(max)} time, your exam is submitted automatically.</p>
        </div>
        <Button variant="dark" onClick={onClose} data-autofocus>
          Back to my exam
        </Button>
      </div>
    </Modal>
  );
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

/** Blocks the screen while the exam is handed in because time ran out (or the 3rd violation). */
export function SubmittingDialog({ open, reason, offline }: { open: boolean; reason: "timeout" | "violations"; offline: boolean }) {
  return (
    <Modal open={open} dismissible={false} role="alertdialog" labelledBy="time-title">
      <div className="flex flex-col items-center gap-4 p-7 text-center md:p-9">
        <IconTile tone="bg-peach-mid text-peach-ink">
          {offline ? <WifiOff className="size-6 md:size-7" aria-hidden /> : <Timer className="size-6 md:size-7" strokeWidth={2.2} aria-hidden />}
        </IconTile>
        <div className="flex flex-col gap-1.5">
          <h2 id="time-title" className="text-2xl font-black">
            {reason === "timeout" ? "Time's up!" : "Handing in your exam"}
          </h2>
          <p className="text-[15px] font-semibold leading-normal text-ink-2">
            {reason === "timeout"
              ? "We're submitting your exam with everything you had saved."
              : "You left the exam window too many times, so we're submitting it for you."}
          </p>
        </div>
        {offline ? (
          <Notice variant="warn" className="text-left">
            You&apos;re offline. We&apos;ll hand it in as soon as you&apos;re connected again. Your answers are safe.
          </Notice>
        ) : (
          <Spinner className="size-7 text-secondary" />
        )}
      </div>
    </Modal>
  );
}
