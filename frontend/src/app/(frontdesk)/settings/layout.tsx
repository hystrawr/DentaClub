"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

/** One tab per settings screen. Dentists, chairs and the rest join here as they are built. */
const TABS = [{ label: "Services", href: "/settings/services" }];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="px-4 sm:px-8 py-6 space-y-5">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-foreground)" }}>
          Settings
        </h1>
        <nav className="mt-4 flex gap-1" style={{ borderBottom: "1px solid var(--color-border)" }}>
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href as Route}
                aria-current={active ? "page" : undefined}
                className={cn("px-3 py-2 text-sm -mb-px", active ? "font-semibold" : "font-medium")}
                style={{
                  color: active ? "var(--color-primary)" : "var(--color-muted-foreground)",
                  borderBottom: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
