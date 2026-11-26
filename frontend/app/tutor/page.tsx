import type { Metadata } from "next";
import { ExamsListScreen } from "@/components/staff/tutor/ExamsList";

export const metadata: Metadata = { title: "My exams" };

export default function TutorHomePage() {
  return <ExamsListScreen />;
}
