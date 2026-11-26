"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { homeFor, useAuth } from "@/lib/auth";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/ui";

/** Splash shown while the saved session is read, and while a redirect is in flight. */
export function Splash() {
  return (
    <div className="bg-dotgrid grid min-h-dvh place-items-center" role="status" aria-label="Loading">
      <Logo className="h-12 animate-pulse" priority />
    </div>
  );
}

/** Keeps signed-out visitors and the wrong role out of a section of the app. */
export function AuthGate({ role, children }: { role: Role | Role[]; children: ReactNode }) {
  const { user, ready } = useAuth();
  const router = useRouter();

  const roles = Array.isArray(role) ? role : [role];
  const allowed = ready && !!user && roles.includes(user.role);

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (!roles.includes(user.role)) router.replace(homeFor(user.role));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, role, router]);

  return allowed ? <>{children}</> : <Splash />;
}
