import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminExamsScreen } from "@/components/staff/admin/AdminExams";

export const metadata: Metadata = { title: "All exams" };

export default function Page() {
  // useSearchParams (the list's filters and page live in the address) needs a Suspense boundary above it
  return (
    <Suspense>
      <AdminExamsScreen />
    </Suspense>
  );
}
