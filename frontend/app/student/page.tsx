import type { Metadata } from "next";
import { StudentHomeScreen } from "@/components/student/StudentHome";

export const metadata: Metadata = { title: "My exams" };

export default function StudentHomePage() {
  return <StudentHomeScreen />;
}
