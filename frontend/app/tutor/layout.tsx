import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { StaffShell } from "@/components/staff/StaffShell";
import { ToastProvider } from "@/components/staff/Toast";

// Admins may open the teacher pages that show an exam, a class or a submission (read only).
export default function TutorLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate role={["tutor", "admin"]}>
      <ToastProvider>
        <StaffShell>{children}</StaffShell>
      </ToastProvider>
    </AuthGate>
  );
}
