import type { Metadata } from "next";
import { AdminExamsScreen } from "@/components/staff/admin/AdminExams";

export const metadata: Metadata = { title: "All exams" };

export default function Page() {
  return <AdminExamsScreen />;
}
