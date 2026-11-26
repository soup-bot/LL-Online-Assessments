import { Suspense } from "react";
import type { Metadata } from "next";
import { QuestionEditorScreen } from "@/components/staff/tutor/QuestionEditor";

export const metadata: Metadata = { title: "Question editor" };

export default function QuestionEditorPage() {
  // useSearchParams needs a Suspense boundary above it
  return (
    <Suspense>
      <QuestionEditorScreen />
    </Suspense>
  );
}
