"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Splash } from "@/components/AuthGate";
import { Button, Card, Chip, Logo } from "@/components/ui";

/**
 * Students are sent to their own area. Tutor and admin screens are the next phase, so
 * they land on a short holding page for now.
 */
export default function DashboardPage() {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (user.role === "student") router.replace("/student");
  }, [ready, user, router]);

  if (!ready || !user || user.role === "student") return <Splash />;

  return (
    <main className="bg-dotgrid grid min-h-dvh place-items-center p-4">
      <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
        <Logo className="h-12" />
        <Chip tone={user.role === "tutor" ? "sky" : "lilac"} size="lg">
          {user.role === "tutor" ? "Tutor" : "Admin"}
        </Chip>
        <h1 className="text-2xl font-black">Hi {user.name.split(" ")[0]}!</h1>
        <p className="text-[15px] font-semibold text-ink-2">
          {user.role === "tutor"
            ? "The exam builder, marking and release screens are the next thing we're building."
            : "Account, class and results screens are the next thing we're building."}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            logout();
            router.replace("/login");
          }}
        >
          <LogOut className="size-5" aria-hidden /> Sign out
        </Button>
      </Card>
    </main>
  );
}
