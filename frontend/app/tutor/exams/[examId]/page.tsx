import type { Metadata } from "next";
import { ExamBuilderScreen } from "@/components/staff/tutor/ExamBuilder";

export const metadata: Metadata = { title: "Exam builder" };

export default function ExamBuilderPage() {
  return <ExamBuilderScreen />;
}
