import type { Metadata } from "next";
import { ResultsListScreen } from "@/components/student/ResultsList";

export const metadata: Metadata = { title: "Your results" };

export default function ResultsPage() {
  return <ResultsListScreen />;
}
