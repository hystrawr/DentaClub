"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Calendar, LayoutDashboard, Settings, Users } from "lucide-react";
import { useIsAdmin } from "@/lib/api/auth";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  /** Shown to admins only; the API also refuses staff on these screens' changes. */
  adminOnly?: boolean;
}

/** Only screens that exist are listed — a nav item that leads nowhere is worse than a missing one. */
const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Appointments", href: "/appointments", icon: Calendar },
  { label: "Patients", href: "/patients", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings, adminOnly: true },
];

/**
 * The front-desk navigation. On a desktop or tablet it is the floating icon
 * rail below the header; on a phone it becomes a bar along the bottom, so the
 * pages keep their whole width.
 */
export function Sidebar() {
  const pathname = usePathname();
  const isAdmin = useIsAdmin();
  const visible = navItems.filter((item) => !item.adminOnly || isAdmin);
  const activeOf = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <aside
        className="hidden md:flex fixed z-30 flex-col"
        style={{
          left: 24,
          top: "calc(var(--header-height) + 16px)",
          bottom: 16,
          width: "var(--rail-width)",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border-strong)",
          borderRadius: 24,
          boxShadow: "0 8px 24px rgb(30 34 16 / 0.08)",
        }}
      >
        <nav aria-label="Main" className="flex-1 flex flex-col justify-center gap-5 py-6">
          {visible.map((item) => (
            <RailLink key={item.href} item={item} active={activeOf(item.href)} />
          ))}
        </nav>
      </aside>

      <nav
        aria-label="Main"
        className="md:hidden fixed z-30 inset-x-0 bottom-0 flex justify-around px-2"
        style={{
          height: "var(--bottom-nav-height)",
          background: "var(--color-canvas)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        {visible.map((item) => (
          <BarLink key={item.href} item={item} active={activeOf(item.href)} />
        ))}
      </nav>
    </>
  );
}

/** A rail destination: a round icon over its label. The active one is filled olive. */
function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href as Route}
      className="group flex flex-col items-center gap-1.5"
      aria-current={active ? "page" : undefined}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full transition-colors duration-150",
          !active && "group-hover:bg-[var(--color-surface-subtle)]",
        )}
        style={{
          width: 44,
          height: 44,
          background: active ? "var(--color-primary)" : undefined,
          border: `1.5px solid ${active ? "var(--color-primary)" : "var(--color-border-strong)"}`,
        }}
      >
        <Icon
          size={19}
          strokeWidth={active ? 2 : 1.75}
          style={{ color: active ? "var(--color-primary-foreground)" : "var(--color-muted-foreground)" }}
          aria-hidden="true"
        />
      </span>
      <span
        className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}
        style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
      >
        {item.label}
      </span>
    </Link>
  );
}

/** A bottom-bar destination on a phone: an icon over its label, the active one on a pale olive pill. */
function BarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex-1 my-1.5 flex flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150",
        !active && "hover:bg-[var(--color-surface-subtle)]",
      )}
      style={{ background: active ? "var(--color-primary-light)" : undefined }}
    >
      <Icon
        size={20}
        strokeWidth={active ? 2 : 1.75}
        style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
        aria-hidden="true"
      />
      <span
        className={cn("text-[11px] leading-none", active ? "font-semibold" : "font-medium")}
        style={{ color: active ? "var(--color-primary)" : "var(--color-muted-foreground)" }}
      >
        {item.label}
      </span>
    </Link>
  );
}
