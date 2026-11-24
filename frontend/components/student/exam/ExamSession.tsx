"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, WifiOff } from "lucide-react";
import { api, toApiError, type ApiError } from "@/lib/api";
import type { AttemptState } from "@/lib/api-types";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { useOnline } from "@/lib/hooks/useOnline";
import { useServerClock } from "@/lib/hooks/useServerClock";
import { useViolationGuard } from "@/lib/hooks/useViolationGuard";
import { ConfirmDialog, SubmittingDialog, ViolationDialog } from "@/components/student/exam/Dialogs";
import { ExamHeader } from "@/components/student/exam/ExamHeader";
import { QuestionGrid, QuestionSheet } from "@/components/student/exam/Navigator";
import { QuestionView } from "@/components/student/exam/QuestionView";
import { ReviewScreen } from "@/components/student/exam/ReviewScreen";
import { isAnswered, tally as computeTally } from "@/components/student/exam/examStatus";
import { useAutosave } from "@/components/student/exam/useAutosave";
import { Button, ErrorState } from "@/components/ui";

/** The running exam. Everything a student does between "Start" and "Submit" lives here. */
export function ExamSession({ initial }: { initial: AttemptState }) {
  const router = useRouter();
  const { attemptId, questions, maxViolations: max } = initial;
  const online = useOnline();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* ---------------------------------------------------------- clock + saving */
  const clock = useServerClock({ serverNow: initial.serverNow, deadlineAt: initial.deadlineAt });
  const { sync } = clock;

  useEffect(() => {
    sync({ serverNow: initial.serverNow, deadlineAt: initial.deadlineAt });
  }, [initial.serverNow, initial.deadlineAt, sync]);

  const goSubmitted = useCallback(() => router.replace(`/student/attempts/${attemptId}/submitted`), [router, attemptId]);

  const [fatal, setFatal] = useState<ApiError | null>(null);
  const handleFatal = useCallback(
    (err: ApiError) => {
      if (err.code === "expired" || err.code === "conflict") goSubmitted();
      else setFatal(err);
    },
    [goSubmitted],
  );

  const autosave = useAutosave({ attemptId, initial: initial.answers, onSync: sync, onFatal: handleFatal });
  const { answers, flushNow, finish } = autosave;
  const tally = useMemo(() => computeTally(questions, answers), [questions, answers]);

  /* --------------------------------------------------------------- navigation */
  const [cur, setCur] = useState(() => {
    // resuming: land on the first question that still needs an answer
    const firstOpen = questions.findIndex((q) => !isAnswered(q, initial.answers));
    return firstOpen === -1 ? 0 : firstOpen;
  });
  const [view, setView] = useState<"question" | "review">("question");
  const [sheet, setSheet] = useState<null | "list" | "review">(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const go = useCallback((index: number) => {
    setCur(index);
    setView("question");
    setSheet(null);
    window.scrollTo({ top: 0 });
  }, []);

  const question = questions[cur];
  const isLast = cur === questions.length - 1;
  const openReview = () => (isDesktop ? setView("review") : setSheet("review"));
  const next = () => (isLast ? openReview() : go(cur + 1));
  const prev = () => cur > 0 && go(cur - 1);

  /* ------------------------------------------------------------------ submit */
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<null | "timeout" | "violations">(null);
  const submitting_ = useRef(false);

  const submit = useCallback(
    async (reason: "manual" | "timeout") => {
      if (submitting_.current) return;
      submitting_.current = true;
      setSubmitError(null);
      if (reason === "manual") setSubmitting(true);
      else setFinishing("timeout");

      const attempt = async (): Promise<boolean> => {
        const saved = await flushNow();
        if (!saved && reason === "manual") {
          setSubmitError(
            "We couldn't save your latest answers. Check your connection and try again. Everything you've typed is safe on this device.",
          );
          return false;
        }
        try {
          await api.student.submit(attemptId, reason);
          finish();
          goSubmitted();
          return true;
        } catch (e) {
          if (reason === "manual") {
            setSubmitError(toApiError(e).message);
            return false;
          }
          // Time is up, so the exam must go in. Keep trying until the connection is back.
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return mounted.current ? attempt() : true;
        }
      };

      const ok = await attempt();
      if (!ok && mounted.current) {
        submitting_.current = false;
        setSubmitting(false);
      }
    },
    [attemptId, finish, flushNow, goSubmitted],
  );

  useEffect(() => {
    if (clock.expired) void submit("timeout");
  }, [clock.expired, submit]);

  /* -------------------------------------------------------------- violations */
  const [violations, setViolations] = useState(initial.violationCount);
  const [warning, setWarning] = useState(false);

  const reportViolation = useCallback(
    (kind: "hidden" | "blur") => {
      // Warn straight away; the server count catches up as soon as the request lands.
      setViolations((v) => v + 1);
      setWarning(true);

      const send = async () => {
        if (!mounted.current) return;
        try {
          await flushNow(); // keep the work: the third violation submits the exam
          const outcome = await api.student.recordViolation(attemptId, kind);
          setViolations(outcome.count);
          if (outcome.autoSubmitted) {
            finish();
            goSubmitted();
          }
        } catch (e) {
          const err = toApiError(e);
          if (err.code === "network") window.setTimeout(send, 3000);
          else if (err.code === "expired" || err.code === "conflict") goSubmitted();
        }
      };
      void send();
    },
    [attemptId, finish, flushNow, goSubmitted],
  );

  useViolationGuard(!finishing && !fatal, reportViolation);

  const finishingReason = finishing ?? (violations >= max ? "violations" : null);

  /* ------------------------------------------------------------ announcements */
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (clock.remainingSec === 300) setAnnouncement("5 minutes left");
    if (clock.remainingSec === 60) setAnnouncement("1 minute left");
  }, [clock.remainingSec]);

  if (fatal) {
    return (
      <div className="bg-dotgrid grid min-h-dvh place-items-center p-4">
        <ErrorState code={fatal.code} message={fatal.message} backHref="/student" />
      </div>
    );
  }

  const offline = !online || autosave.status === "error";
  const nextLabel = isLast ? "Review answers" : "Next question";

  return (
    <div className="bg-dotgrid flex min-h-dvh flex-col">
      <ExamHeader
        title={initial.title}
        subtitle={initial.subtitle}
        saveStatus={autosave.status}
        online={online}
        remainingSec={clock.remainingSec}
        questions={questions}
        answers={answers}
        currentId={question.id}
        tally={tally}
        onOpenSheet={() => setSheet("list")}
      />

      {offline && (
        <div className="bg-amber text-amber-ink" role="status">
          <div className="mx-auto flex max-w-[1100px] items-center gap-3 px-4 py-2.5 text-sm font-bold lg:px-7">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            <p className="flex-1">
              You&apos;re offline. Keep going: your answers are saved on this device and will sync when you&apos;re back.
            </p>
            <button type="button" onClick={() => void autosave.retryNow()} className="rounded-full bg-white/70 px-3 py-1 font-black hover:bg-white">
              Retry now
            </button>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1100px] flex-1 px-4 pb-32 pt-4 lg:px-7 lg:pb-12 lg:pt-8">
        {view === "review" && isDesktop ? (
          <ReviewScreen
            questions={questions}
            answers={answers}
            tally={tally}
            onGo={go}
            onBack={() => go(cur)}
            onSubmit={() => setConfirmOpen(true)}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
            <main>
              <QuestionView
                question={question}
                total={questions.length}
                answer={answers[question.id]}
                onChange={(value, immediate) => autosave.setResponse(question.id, value, immediate)}
                onToggleFlag={() => autosave.toggleFlag(question.id, !answers[question.id]?.flagged)}
              />
              <div className="mt-5 hidden items-center justify-between lg:flex">
                <Button variant="secondary" onClick={prev} disabled={cur === 0}>
                  <ArrowLeft className="size-5" aria-hidden /> Previous
                </Button>
                <Button onClick={next}>
                  {nextLabel} <ArrowRight className="size-5" aria-hidden />
                </Button>
              </div>
            </main>
            <aside className="hidden lg:block" aria-label="Question list">
              <QuestionGrid
                questions={questions}
                answers={answers}
                currentId={question.id}
                tally={tally}
                onGo={go}
                onReview={() => setView("review")}
              />
            </aside>
          </div>
        )}
      </div>

      {/* phones: sticky previous / next */}
      {view === "question" && (
        <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-line-header bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
          <div className="mx-auto grid max-w-xl grid-cols-3 gap-2.5">
            <Button variant="secondary" onClick={prev} disabled={cur === 0} className="h-[52px]">
              <ArrowLeft className="size-5" aria-hidden /> Prev
            </Button>
            <Button onClick={next} className="col-span-2 h-[52px]">
              {nextLabel} <ArrowRight className="size-5" aria-hidden />
            </Button>
          </div>
        </footer>
      )}

      <QuestionSheet
        open={sheet !== null && !isDesktop}
        mode={sheet ?? "list"}
        onClose={() => setSheet(null)}
        questions={questions}
        answers={answers}
        currentId={question.id}
        tally={tally}
        remainingSec={clock.remainingSec}
        onGo={go}
        onSubmit={() => {
          setSheet(null);
          setConfirmOpen(true);
        }}
      />

      <ConfirmDialog
        open={confirmOpen && !finishingReason}
        onClose={() => {
          setConfirmOpen(false);
          setSubmitError(null);
        }}
        onSubmit={() => void submit("manual")}
        tally={tally}
        remainingSec={clock.remainingSec}
        submitting={submitting}
        error={submitError}
      />

      <ViolationDialog open={warning && violations < max && !finishingReason} count={violations} max={max} onClose={() => setWarning(false)} />

      <SubmittingDialog open={finishingReason !== null} reason={finishingReason ?? "timeout"} offline={offline} />

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
