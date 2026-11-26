import type { Metadata } from "next";
import { ExamSessionsScreen } from "@/components/staff/tutor/ExamSessions";

export const metadata: Metadata = { title: "Classes and submissions" };

export default function ExamSessionsPage() {
  return <ExamSessionsScreen />;
}
