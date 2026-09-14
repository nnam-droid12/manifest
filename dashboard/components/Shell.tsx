"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";

// The dashboard is intentionally open — no sign-in required to view it.
// Cognito auth still exists (see lib/auth.ts, /login) for brokers who want a
// personalized session, but nothing in the app gates on it. The mount-gate
// below isn't an auth check — it just defers Sidebar's sessionStorage read
// until after hydration, since that value can't be known during static
// prerendering and reading it inline on first render causes a hydration
// mismatch.
export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (pathname === "/" || pathname === "/login") return <>{children}</>;
  if (!mounted) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 px-10 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
