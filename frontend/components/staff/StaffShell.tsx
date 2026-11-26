"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, PenLine, School, UserRound, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { tutorApi } from "@/lib/api-staff";
import { useAsync } from "@/lib/hooks/useAsync";
import { cn } from "@/lib/utils";
import { AccountMenu } from "@/components/student/StudentShell";
import { LogoMark } from "@/components/ui";
import { NavTabs, type NavTab } from "@/components/ui/NavTabs";

const tutorTabs: NavTab[] = [
  { id: "exams", href: "/tutor", label: "Exams", Icon: FileText },
  { id: "marking", href: "/tutor/marking", label: "To mark", Icon: PenLine, badge: <ToMarkBadge /> },
  { id: "classes", href: "/tutor/classes", label: "My classes", Icon: Users },
];

const adminTabs: NavTab[] = [
  { id: "users", href: "/admin/users", label: "Users", Icon: UserRound },
  { id: "admin-classes", href: "/admin/classes", label: "Classes", Icon: School },
  { id: "admin-exams", href: "/admin/exams", label: "All exams", Icon: FileText },
];

function ToMarkBadge() {
  const { data } = useAsync(() => tutorApi.toMarkCount(), []);
  if (!data) return null;
  return (
    <span className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-amber px-1.5 text-xs font-black text-amber-ink">{data}</span>
  );
}

/** Which tab a page belongs to, from its address. */
function activeTab(path: string, admin: boolean): string | undefined {
  if (admin) {
    if (path.startsWith("/admin/classes")) return "admin-classes";
    if (path.startsWith("/admin/users")) return "users";
    return "admin-exams"; // the exam, class and submission pages an admin opens read-only
  }
  if (path.startsWith("/tutor/marking") || path.startsWith("/tutor/attempts")) return "marking";
  if (path.startsWith("/tutor/classes")) return "classes";
  return "exams";
}

/**
 * Page chrome for teacher and admin screens, mounted once in the layout so the navigation
 * highlight can slide between tabs. The account menu holds the name and Sign out.
 */
export function StaffShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const path = usePathname();
  const admin = user?.role === "admin";

  return (
    <div className="bg-dotgrid flex min-h-dvh flex-col">
      <header className="border-b border-line-header bg-white">
        <div className="mx-auto flex min-h-[64px] w-full max-w-[1180px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 md:min-h-[72px] md:gap-x-6 md:px-7 md:py-3">
          <Link href={admin ? "/admin" : "/tutor"} aria-label="LL Assessments home" className="flex items-center gap-3 no-underline">
            <LogoMark />
            <span className="text-lg font-black text-ink">{admin ? "Admin" : "Teacher portal"}</span>
          </Link>
          <NavTabs
            tabs={admin ? adminTabs : tutorTabs}
            active={activeTab(path, admin)}
            className="order-last w-full pb-1 md:order-none md:w-auto md:flex-1 md:pb-0"
          />
          <AccountMenu className="ml-auto md:ml-0" />
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** Centered content column under the header. */
export function StaffMain({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-4 pb-16 pt-5 md:gap-[22px] md:px-7 md:pb-14 md:pt-8", className)}>
      {children}
    </main>
  );
}
