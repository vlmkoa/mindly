import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "________ — stillness, reflection, dissolution",
  description:
    "A meditation, sobriety, journal, and planner app — with a koan mirror to unsettle certainty.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* AppShell is a client component: it owns the auth check + nav. */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
