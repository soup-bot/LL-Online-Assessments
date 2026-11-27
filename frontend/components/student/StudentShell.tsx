"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, LogOut, Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button, LogoMark, Modal } from "@/components/ui";
import { NavTabs } from "@/components/ui/NavTabs";

type Tab = "exams" | "results";

const tabs: { id: Tab; href: string; label: string; Icon: typeof FileText }[] = [
  { id: "exams", href: "/student", label: "My exams", Icon: FileText },
  { id: "results", href: "/student/results", label: "Results", Icon: Trophy },
];

/** The signed-in person's picture: a white outline of a person on the app's violet. The file is cropped to the drawing, so it centres exactly. */
function Avatar({ className }: { name?: string; className?: string; role?: "student" | "tutor" | "admin" }) {
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-squiggly bg-secondary", className)}>
      <Image src="/avatar.png" alt="" unoptimized width={240} height={277} className="h-auto w-[54%]" />
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
        <Avatar name={user.name} role={user.role} className="size-11 text-[15px]" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} variant="sheet" labelledBy="account-title">
        <div className="flex flex-col gap-4 px-5 pb-7 pt-1">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} role={user.role} className="size-12 text-base" />
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

/** Desktop avatar: opens a small menu with the account name and Sign out. */
export function AccountMenu({ className }: { className?: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={wrapper} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        className="rounded-full transition hover:ring-4 hover:ring-secondary-ring/60 aria-expanded:ring-4 aria-expanded:ring-secondary-ring"
      >
        <Avatar name={user.name} role={user.role} className="size-10 text-sm" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+10px)] z-40 w-64 origin-top-right overflow-hidden rounded-2xl border border-line bg-white p-1.5 shadow-xl"
        >
          <div className="px-3 pb-2.5 pt-2">
            <p className="truncate text-sm font-black">{user.name}</p>
            <p className="truncate text-xs font-semibold text-muted">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-line" aria-hidden />
          <button
            role="menuitem"
            type="button"
            autoFocus
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-extrabold hover:bg-chip"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function DesktopHeader({ active }: { active?: Tab }) {
  return (
    <header className="hidden border-b border-line-header bg-white md:block">
      <div className="mx-auto flex min-h-[72px] w-full max-w-[1140px] flex-wrap items-center gap-x-6 gap-y-3 px-7 py-3">
      <Link href="/student" aria-label="LL Assessments home" className="flex items-center">
        <LogoMark />
      </Link>
      <NavTabs tabs={tabs} active={active} className="flex-1" />
      <AccountMenu />
      </div>
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
            "flex h-[50px] items-center justify-center gap-2 rounded-full no-underline transition active:scale-95",
            active === id ? "bg-secondary-soft font-black text-secondary-dark" : "font-extrabold text-ink-2",
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
