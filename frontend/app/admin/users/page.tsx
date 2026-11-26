import type { Metadata } from "next";
import { AdminUsersScreen } from "@/components/staff/admin/AdminUsers";

export const metadata: Metadata = { title: "Users" };

export default function Page() {
  return <AdminUsersScreen />;
}
