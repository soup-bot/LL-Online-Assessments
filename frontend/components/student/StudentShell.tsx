"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, LogOut, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn, initials } from "@/lib/utils";
import { Button, Logo, Modal } from "@/components/ui";

type Tab = "exams" | "results";

const tabs: { id: Tab; href: string; label: string; Icon: typeof FileText }[] = [
  { id: "exams", href: "/student", label: "My exams", Icon: FileText },
  { id: "results", href: "/student/results", label: "Results", Icon: Trophy },
];

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full bg-mint font-black text-mint-deep", className)}
    >
      {initials(name)}
    </span>
  );
}

/** Round avatar for phones. Opens a sheet with the account name and Sign out. */
export function AccountButton({ className }: { className?: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Account: ${user.name}`}
        className={cn("rounded-full transition active:scale-95", className)}
      >
        <Avatar name={user.name} className="size-11 text-[15px]" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} variant="sheet" labelledBy="account-title">
        <div className="flex flex-col gap-4 p-5 pb-7">
          <span aria-hidden className="mx-auto h-[5px] w-11 rounded-full bg-[#ddd7cd]" />
          <div className="flex items-center gap-3">
            <Avatar name={user.name} className="size-12 text-base" />
            <div>
              <h2 id="account-title" className="text-lg font-black">
                {user.name}
              </h2>
              <p className="text-sm font-bold text-muted">{user.email}</p>
            </div>
          </div>
          <Button
            variant="secondary"
            block
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            <LogOut className="size-5" aria-hidden /> Sign out
          </Button>
        </div>
      </Modal>
    </>
  );
}

function DesktopHeader({ active }: { active?: Tab }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="hidden min-h-[72px] flex-wrap items-center gap-x-6 gap-y-3 border-b border-line-header bg-white px-7 py-3 md:flex">
      <Link href="/student" aria-label="LL Assessments home" className="flex items-center">
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex flex-1 gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={t.href}
            aria-current={active === t.id ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-full px-4 no-underline transition",
              active === t.id ? "bg-brand-tint font-extrabold text-brand-dark" : "font-bold text-ink-2 hover:bg-chip hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {user && (
        <div className="flex items-center gap-2.5">
          <Avatar name={user.name} className="size-10 text-sm" />
          <span className="text-sm font-extrabold">{user.name}</span>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="ml-1.5 rounded-full px-2 py-1 text-sm font-bold text-brand hover:bg-chip"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}

function BottomNav({ active }: { active?: Tab }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2.5 border-t border-line-header bg-white px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2.5 md:hidden"
    >
      {tabs.map(({ id, href, label, Icon }) => (
        <Link
          key={id}
          href={href}
          aria-current={active === id ? "page" : undefined}
          className={cn(
            "flex h-[50px] items-center justify-center gap-2 rounded-full no-underline transition",
            active === id ? "bg-brand-tint font-black text-brand-dark" : "font-extrabold text-ink-2",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2.4} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Page chrome for signed-in student screens. Desktop gets a top bar; phones get the
 * bottom tab bar when `bottomNav` is set (the main tabs) and a back link elsewhere.
 */
export function StudentShell({
  active,
  bottomNav = false,
  children,
}: {
  active?: Tab;
  bottomNav?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="bg-dotgrid flex min-h-dvh flex-col">
      <DesktopHeader active={active} />
      <div className={cn("flex-1", bottomNav && "pb-28 md:pb-0")}>{children}</div>
      {bottomNav && <BottomNav active={active} />}
    </div>
  );
}
