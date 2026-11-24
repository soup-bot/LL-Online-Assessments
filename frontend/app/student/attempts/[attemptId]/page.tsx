import type { Metadata } from "next";
import { ExamRunner } from "@/components/student/exam/ExamRunner";

export const metadata: Metadata = { title: "Exam in progress" };

export default function AttemptPage() {
  return <ExamRunner />;
}
