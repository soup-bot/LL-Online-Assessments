import type { Metadata } from "next";
import { ImportExamScreen } from "@/components/staff/tutor/ImportExam";

export const metadata: Metadata = { title: "Import an exam" };

export default function ImportExamPage() {
  return <ImportExamScreen />;
}
