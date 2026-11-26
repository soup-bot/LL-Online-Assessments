import type { Metadata } from "next";
import { MarkAttemptScreen } from "@/components/staff/tutor/MarkAttempt";

export const metadata: Metadata = { title: "Mark a submission" };

export default function Page() {
  return <MarkAttemptScreen />;
}
