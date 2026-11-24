"use client";

import { useEffect } from "react";
import { SAVE_GRACE_MS } from "@/lib/config";
import { useServerClock } from "@/lib/hooks/useServerClock";
import { formatClock } from "@/lib/utils";

/**
 * Live "mm:ss left" for an attempt that is already running. Once the time is out and the
 * server's grace period has passed, calls `onExpired` so the screen can refetch.
 */
export function LiveClock({
  deadlineAt,
  serverNow,
  onExpired,
  suffix = " left",
}: {
  deadlineAt: string;
  serverNow: string;
  onExpired?: () => void;
  suffix?: string;
}) {
  const { remainingSec, expired, sync } = useServerClock({ deadlineAt, serverNow });

  useEffect(() => {
    sync({ deadlineAt, serverNow });
  }, [deadlineAt, serverNow, sync]);

  useEffect(() => {
    if (!expired || !onExpired) return;
    const id = window.setTimeout(onExpired, SAVE_GRACE_MS + 500);
    return () => window.clearTimeout(id);
  }, [expired, onExpired]);

  if (expired) return <>Time&apos;s up</>;
  return (
    <>
      {formatClock(remainingSec)}
      {suffix}
    </>
  );
}
