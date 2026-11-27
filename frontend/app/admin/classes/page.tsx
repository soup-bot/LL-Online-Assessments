import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminClassesScreen } from "@/components/staff/admin/AdminClasses";

export const metadata: Metadata = { title: "Classes" };

export default function Page() {
  // useSearchParams (the list's filters and page live in the address) needs a Suspense boundary above it
  return (
    <Suspense>
      <AdminClassesScreen />
    </Suspense>
  );
}
