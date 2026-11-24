import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Nunito } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import { DemoTools } from "@/components/DemoTools";
import "./globals.css";

// Variable font: every weight from 200 to 1000 is available.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LL Assessments",
    template: "%s · LL Assessments",
  },
  description: "Online exams for Limitless Learning",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#015746",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" className={nunito.variable}>
      <body className="min-h-dvh antialiased">
        <AuthProvider>
          {children}
          <DemoTools />
        </AuthProvider>
      </body>
    </html>
  );
}
