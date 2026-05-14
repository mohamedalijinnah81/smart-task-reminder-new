// components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen w-full" style={{ background: "#f1f2f4" }}>
      {/* Trello-style blue header */}
      <header
        className="h-12 sticky top-0 z-50 flex items-center px-4 gap-3 shrink-0"
        style={{ background: "#0052cc" }}
      >
        <Link
          href="/tasks"
          className="flex items-center gap-2 font-bold text-white text-lg tracking-tight"
        >
          <CheckSquare className="w-5 h-5" />
          TaskChaser
        </Link>

        <div className="flex-1" />

        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium text-white/80 hover:text-white hover:bg-white/20 transition-colors",
            pathname === "/settings" && "bg-white/20 text-white"
          )}
        >
          <Settings className="w-4 h-4" />
          <span className="hidden sm:inline">Settings</span>
        </Link>
      </header>

      <main className="flex-1 w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}