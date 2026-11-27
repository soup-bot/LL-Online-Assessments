import { Suspense } from "react";
import type { Metadata } from "next";
import { ToMarkScreen } from "@/components/staff/tutor/ToMarkList";

export const metadata: Metadata = { title: "To mark" };

export default function Page() {
  // useSearchParams (the list's filters and page live in the address) needs a Suspense boundary above it
  return (
    <Suspense>
      <ToMarkScreen />
    </Suspense>
  );
}
