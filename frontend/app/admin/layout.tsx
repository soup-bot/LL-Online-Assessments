import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";
import { StaffShell } from "@/components/staff/StaffShell";
import { ToastProvider } from "@/components/staff/Toast";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate role="admin">
      <ToastProvider>
        <StaffShell>{children}</StaffShell>
      </ToastProvider>
    </AuthGate>
  );
}
