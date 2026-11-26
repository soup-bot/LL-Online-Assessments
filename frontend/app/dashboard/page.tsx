"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { homeFor, useAuth } from "@/lib/auth";
import { Splash } from "@/components/AuthGate";

/** Legacy landing path: send everyone to their own area. */
export default function DashboardPage() {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? homeFor(user.role) : "/login");
  }, [ready, user, router]);

  return <Splash />;
}
