"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Calendar, LayoutDashboard, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

/** Only screens that exist are listed — a nav item that leads nowhere is worse than a missing one. */
const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Appointments", href: "/appointments", icon: Calendar },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
];

/** Floating icon rail below the app header, always shown. */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed z-30 flex flex-col"
      style={{
        left: 16,
        top: "calc(var(--header-height) + 16px)",
        bottom: 16,
        width: "var(--rail-width)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-strong)",
        borderRadius: 24,
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
      }}
    >
      <nav className="flex-1 flex flex-col justify-center gap-6 py-6">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              className="group flex flex-col items-center gap-1.5"
              aria-current={isActive ? "page" : undefined}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full transition-colors duration-150",
                  !isActive && "group-hover:bg-slate-50",
                )}
                style={{
                  width: 48,
                  height: 48,
                  background: isActive ? "var(--color-primary)" : undefined,
                  border: `1.5px solid ${isActive ? "var(--color-primary)" : "var(--color-border-strong)"}`,
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2 : 1.75}
                  style={{ color: isActive ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)" }}
                  aria-hidden="true"
                />
              </span>
              <span
                className={cn("text-[11px]", isActive ? "font-semibold" : "font-medium")}
                style={{ color: isActive ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
