import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manifest — Broker Dashboard",
  description: "The human-in-the-loop control surface for the Manifest agent swarm.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
