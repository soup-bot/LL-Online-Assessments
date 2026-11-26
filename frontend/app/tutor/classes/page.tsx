import type { Metadata } from "next";
import { MyClassesScreen } from "@/components/staff/tutor/MyClasses";

export const metadata: Metadata = { title: "My classes" };

export default function Page() {
  return <MyClassesScreen />;
}
