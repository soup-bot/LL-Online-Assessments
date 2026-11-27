import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamsListScreen } from "@/components/staff/tutor/ExamsList";

export const metadata: Metadata = { title: "My exams" };

export default function Page() {
  // useSearchParams (the list's filters and page live in the address) needs a Suspense boundary above it
  return (
    <Suspense>
      <ExamsListScreen />
    </Suspense>
  );
}
