"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui";

/** Catches anything that throws while rendering a page. `reset` retries the render. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-dotgrid grid min-h-dvh place-items-center p-4">
      <ErrorState
        message="That page hit a problem. Your answers are safe. Try again, and if it keeps happening, tell your teacher."
        onRetry={reset}
        backHref="/"
        backLabel="Go to the start"
      />
    </div>
  );
}
