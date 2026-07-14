import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR OS — Autonomous AI HR Operating System",
  description:
    "Multi-tenant autonomous AI platform for the complete workforce lifecycle — hiring, onboarding, employee support, and offboarding.",
  keywords: ["HR", "AI", "recruitment", "workforce", "autonomous", "multi-tenant"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
