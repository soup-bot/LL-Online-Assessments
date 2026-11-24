import type { Metadata } from "next";
import { CoverScreen } from "@/components/student/CoverScreen";

export const metadata: Metadata = { title: "Before you start" };

export default function CoverPage() {
  return <CoverScreen />;
}
