import type { Metadata } from "next";
import { ToMarkScreen } from "@/components/staff/tutor/ToMarkList";

export const metadata: Metadata = { title: "To mark" };

export default function Page() {
  return <ToMarkScreen />;
}
