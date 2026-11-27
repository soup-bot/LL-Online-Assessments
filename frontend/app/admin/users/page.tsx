import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminUsersScreen } from "@/components/staff/admin/AdminUsers";

export const metadata: Metadata = { title: "Users" };

export default function Page() {
  // useSearchParams (the list's filters and page live in the address) needs a Suspense boundary above it
  return (
    <Suspense>
      <AdminUsersScreen />
    </Suspense>
  );
}
