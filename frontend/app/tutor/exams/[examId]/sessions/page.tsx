import { Suspense } from "react";
import type { Metadata } from "next";
import { ExamSessionsScreen } from "@/components/staff/tutor/ExamSessions";

export const metadata: Metadata = { title: "Classes and submissions" };

export default function Page() {
  // useSearchParams (the list's filters and page live in the address) needs a Suspense boundary above it
  return (
    <Suspense>
      <ExamSessionsScreen />
    </Suspense>
  );
}
