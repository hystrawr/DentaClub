"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Calendar, ChevronRight, ListOrdered, LogOut, UserRound, Users } from "lucide-react";
import { useCurrentUser, useSignOut } from "@/lib/api/auth";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

/**
 * Ported from DentalOS's Sidebar. Only screens that exist are listed — a nav
 * item that leads nowhere is worse than a missing one. (DentalOS's help card
 * is left out.)
 */
const navItems: NavItem[] = [
  { label: "Queue", href: "/queue", icon: ListOrdered },
  { label: "Schedule", href: "/schedule", icon: Calendar },
  { label: "Patients", href: "/patients", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useCurrentUser();
  const signOut = useSignOut();

  return (
    <aside
      className="flex flex-col h-full shrink-0"
      style={{
        width: "var(--sidebar-width)",
        background: "var(--color-surface)",
        borderRight: "1px solid var(--color-border)",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-3 px-5"
        style={{ height: "var(--header-height)", borderBottom: "1px solid var(--color-border)" }}
      >
        <div
          className="flex items-center justify-center rounded-xl shrink-0"
          style={{ width: 36, height: 36, background: "linear-gradient(135deg, #2563EB 0%, #0D9488 100%)" }}
        >
          <Activity size={18} color="#fff" strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: "var(--color-foreground)", lineHeight: 1.2 }}>
            DentaClub
          </p>
          <p className="text-xs" style={{ color: "var(--color-muted-foreground)", lineHeight: 1.4 }}>
            Clinic Manager
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-subtle-foreground)" }}>
          
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href as Route}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                isActive ? "nav-pill-active" : "hover:bg-slate-50",
              )}
              style={isActive ? {} : { color: "var(--color-muted-foreground)" }}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                size={18}
                strokeWidth={isActive ? 2 : 1.75}
                style={{ color: isActive ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
                className="shrink-0"
              />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={14} style={{ color: "var(--color-primary)" }} className="opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* Signed-in user */}
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--color-border)" }}>
        <UserRound size={16} style={{ color: "var(--color-muted-foreground)" }} className="shrink-0" aria-hidden="true" />
        <span className="flex-1 min-w-0 truncate text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
          {user.data?.username}
        </span>
        <button
          type="button"
          onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace("/login") })}
          disabled={signOut.isPending}
          className="flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2.5 py-1.5 hover:bg-slate-50"
          style={{ color: "var(--color-muted-foreground)", border: "1px solid var(--color-border)" }}
        >
          <LogOut size={13} aria-hidden="true" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
