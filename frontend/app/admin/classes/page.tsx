import type { Metadata } from "next";
import { AdminClassesScreen } from "@/components/staff/admin/AdminClasses";

export const metadata: Metadata = { title: "Classes" };

export default function Page() {
  return <AdminClassesScreen />;
}
