"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ChevronDown, Users } from "lucide-react";
import { tutorApi } from "@/lib/api-staff";
import { useAsync } from "@/lib/hooks/useAsync";
import type { PersonLite } from "@/lib/staff-types";
import { cn, plural } from "@/lib/utils";
import { PageHeader, StatusChip } from "@/components/staff/bits";
import { StaffMain } from "@/components/staff/StaffShell";
import { Card, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import type { ChipTone } from "@/components/ui/Chip";

/** The same colours and wording as the exams table: green and pinging while open, blue once results are out, violet when published but not open yet. */
function examChip(e: { status: "not_open" | "open" | "closed"; released: boolean }): { tone: ChipTone; label: string; dot?: string } {
  if (e.released) return { tone: "sky", label: "Results released" };
  if (e.status === "open") return { tone: "mint", label: "Open now", dot: "bg-mint-ink" };
  if (e.status === "closed") return { tone: "neutral", label: "Closed" };
  return { tone: "lilac", label: "Published" };
}

/** Circles shown while the list is collapsed; the rest become "+N". */
const STACK_MAX = 6;

/**
 * A class's students. Collapsed, only their profile circles show, overlapping a little. Clicking spreads the
 * same circles apart and each one grows into a pill with the student's name; clicking again folds them back.
 */
function Students({ students }: { students: PersonLite[] }) {
  const [open, setOpen] = useState(false);
  if (students.length === 0) return <p className="text-sm font-bold text-muted">No students yet.</p>;
  const visible = open ? students : students.slice(0, STACK_MAX);
  const extra = students.length - visible.length;

  return (
    <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 520, damping: 38 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} the names of the ${plural(students.length, "student")}`}
        className="-mx-1.5 flex w-fit max-w-full items-start gap-3 rounded-3xl px-1.5 py-1 text-left transition-colors hover:bg-paper/70"
      >
        <span className={cn("flex flex-wrap items-center", open ? "gap-2" : "-space-x-3")}>
          <AnimatePresence initial={false}>
            {visible.map((st) => (
              <motion.span
                key={st.id}
                layout
                className={cn("flex h-10 items-center rounded-full pl-1 transition-colors", open ? "bg-paper pr-3.5" : "bg-white pr-1")}
              >
                <motion.span layout="position" aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-mint text-xs font-black text-mint-deep">
                  {st.initials}
                </motion.span>
                {open && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="overflow-hidden whitespace-nowrap pl-2 text-sm font-extrabold"
                  >
                    {st.name}
                  </motion.span>
                )}
              </motion.span>
            ))}
          </AnimatePresence>
          {extra > 0 && (
            <motion.span layout className="grid size-10 place-items-center rounded-full bg-white p-1">
              <span className="grid size-8 place-items-center rounded-full bg-chip text-xs font-black text-ink-2">+{extra}</span>
            </motion.span>
          )}
        </span>
        <ChevronDown aria-hidden strokeWidth={3} className={cn("mt-3 size-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
    </MotionConfig>
  );
}

export function MyClassesScreen() {
  const { data, error, loading, reload } = useAsync(() => tutorApi.classes(), []);
  return (
    <>
      <StaffMain>
        <PageHeader title="My classes" subtitle="Who you teach and which exams each class has." />
        {loading && <Skeleton className="h-52 rounded-[28px]" />}
        {error && <ErrorState code={error.code} message={error.message} onRetry={reload} backHref="/tutor" backLabel="Back to my exams" />}
        {data && data.length === 0 && <EmptyState title="No classes yet" Icon={Users}>An admin sets up classes and assigns them to you.</EmptyState>}
        {data && data.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {data.map((c) => (
              <Card key={c.id} className="flex flex-col gap-4 p-[22px]">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-[21px] font-black">{c.name}</h2>
                  <span className="text-[13px] font-bold text-muted">
                    {c.subjectCode} · Grade {c.grade} · {plural(c.students.length, "student")}
                  </span>
                </div>
                <Students students={c.students} />
                <div className="flex flex-col gap-2 border-t border-line-header pt-3.5">
                  <h3 className="text-sm font-black text-muted">Exams</h3>
                  {c.exams.length === 0 && <p className="text-sm font-bold text-muted">None yet.</p>}
                  {c.exams.map((e) => {
                    const chip = examChip(e);
                    return (
                    <Link key={e.sessionId} href={`/tutor/exams/${e.examId}/sessions`} className="flex items-center justify-between gap-3 rounded-2xl bg-canvas px-3.5 py-3 text-sm font-extrabold text-ink no-underline hover:bg-paper hover:text-ink">
                      <span className="min-w-0 truncate">{e.title}</span>
                      <StatusChip tone={chip.tone} dot={chip.dot}>
                        {chip.label}
                      </StatusChip>
                    </Link>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </StaffMain>
    </>
  );
}
