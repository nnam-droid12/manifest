"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSession, logout } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/audit", label: "Audit Trail" },
  { href: "/approvals", label: "Approvals" },
  { href: "/analytics", label: "Analytics" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = typeof window !== "undefined" ? getSession() : null;

  return (
    <aside className="w-60 shrink-0 bg-ink text-white flex flex-col min-h-screen">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="text-lg font-semibold tracking-tight">Manifest</div>
        <div className="text-xs text-white/50 mt-0.5">Broker Dashboard</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                active ? "bg-white/15 text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-6 py-4 border-t border-white/10">
        {session && <div className="text-xs text-white/60 mb-2 truncate">{session.email}</div>}
        <button
          onClick={() => {
            logout();
            router.push("/login");
          }}
          className="text-xs text-white/50 hover:text-white transition-colors mb-2 block"
        >
          Sign out
        </button>
        <div className="text-xs text-white/30">Demo data — see agents/README.md</div>
      </div>
    </aside>
  );
}
