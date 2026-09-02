import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Manifest — Broker Dashboard",
  description: "The human-in-the-loop control surface for the Manifest agent swarm.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-10 py-8 max-w-6xl">{children}</main>
        </div>
      </body>
    </html>
  );
}
