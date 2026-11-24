import type { Metadata } from "next";
import { ResultDetailScreen } from "@/components/student/ResultDetail";

export const metadata: Metadata = { title: "Your result" };

export default function ResultPage() {
  return <ResultDetailScreen />;
}
