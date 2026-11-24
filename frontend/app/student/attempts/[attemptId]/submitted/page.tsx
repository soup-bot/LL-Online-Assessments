import type { Metadata } from "next";
import { SubmittedScreen } from "@/components/student/SubmittedScreen";

export const metadata: Metadata = { title: "Exam submitted" };

export default function SubmittedPage() {
  return <SubmittedScreen />;
}
