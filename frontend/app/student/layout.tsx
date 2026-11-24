import type { ReactNode } from "react";
import { AuthGate } from "@/components/AuthGate";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <AuthGate role="student">{children}</AuthGate>;
}
