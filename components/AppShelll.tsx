// components/AppShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Settings, Bell, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/tasks", label: "Board", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top navbar */}
      <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 flex items-center px-6 gap-4">
        <Link href="/tasks" className="flex items-center gap-2 font-semibold text-primary">
          <CheckSquare className="w-5 h-5" />
          <span className="text-base">TaskChaser</span>
        </Link>

        <nav className="flex items-center gap-1 ml-6">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Email reminders active</span>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}