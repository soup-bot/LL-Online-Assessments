"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, toApiError } from "@/lib/api";
import type { AttemptState } from "@/lib/api-types";
import { clearAttemptCache, loadAttemptCache, saveAttemptCache } from "@/lib/attempt-cache";
import { useAsync } from "@/lib/hooks/useAsync";
import { ExamSession } from "@/components/student/exam/ExamSession";
import { ErrorState, Skeleton } from "@/components/ui";

interface Loaded {
  state: AttemptState;
  /** True when the server couldn't be reached and the copy kept on this device was used. */
  fromCache: boolean;
}

/**
 * Loads the attempt, then hands over to the running exam. If the connection is down it falls
 * back to the copy kept on the device, so a reload mid-exam doesn't lock the student out.
 * Anything not in progress goes to "submitted".
 */
export function ExamRunner() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = Number(params.attemptId);
  const router = useRouter();

  const { data, error, loading, reload } = useAsync<Loaded>(async () => {
    try {
      const state = await api.student.attempt(attemptId);
      if (state.status === "in_progress") saveAttemptCache(state);
      else clearAttemptCache(attemptId);
      return { state, fromCache: false };
    } catch (e) {
      const err = toApiError(e);
      const cached = err.code === "network" ? loadAttemptCache(attemptId) : null;
      if (cached) return { state: cached, fromCache: true };
      throw err;
    }
  }, [attemptId]);

  const finished = data != null && data.state.status !== "in_progress";

  useEffect(() => {
    if (finished) router.replace(`/student/attempts/${attemptId}/submitted`);
  }, [finished, attemptId, router]);

  if (error) {
    return (
      <div className="bg-dotgrid grid min-h-dvh place-items-center p-4">
        <ErrorState code={error.code} message={error.message} onRetry={error.code === "network" ? reload : undefined} backHref="/student" />
      </div>
    );
  }
  if (loading || !data || finished) return <ExamSkeleton />;

  return <ExamSession initial={data.state} fromCache={data.fromCache} />;
}

function ExamSkeleton() {
  return (
    <div className="bg-dotgrid min-h-dvh" aria-busy="true" aria-label="Loading your exam">
      <div className="h-24 border-b border-line-header bg-white" />
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 pt-6 lg:px-7">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-80 rounded-[28px]" />
      </div>
    </div>
  );
}
