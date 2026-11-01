"use client";

import { useRouter } from "next/navigation";
import { Activity, LogOut } from "lucide-react";
import { useCurrentUser, useSignOut } from "@/lib/api/auth";

/** The bar across the top of every front-desk page: brand on the left, who's signed in on the right. */
export function AppHeader() {
  const router = useRouter();
  const user = useCurrentUser();
  const signOut = useSignOut();
  const username = user.data?.username ?? "";
  const role = user.data?.role;

  return (
    <header
      className="flex items-center justify-between gap-4 px-6 shrink-0"
      style={{
        height: "var(--header-height)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 36, height: 36, background: "linear-gradient(135deg, #2563EB 0%, #0D9488 100%)" }}
        >
          <Activity size={18} color="#fff" strokeWidth={2} aria-hidden="true" />
        </div>
        <p className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
          The DentaClub
        </p>
      </div>

      <div
        className="flex items-center gap-2.5 rounded-xl pl-1.5 pr-1.5 py-1.5"
        style={{ border: "1px solid var(--color-border-strong)" }}
      >
        <div
          className="flex items-center justify-center rounded-full text-xs font-bold uppercase shrink-0"
          style={{ width: 30, height: 30, background: "var(--color-primary-light)", color: "var(--color-primary)" }}
          aria-hidden="true"
        >
          {username.slice(0, 1)}
        </div>
        <span className="flex flex-col leading-tight min-w-0">
          <span className="max-w-40 truncate text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            {username}
          </span>
          {role && (
            <span className="text-[11px] font-medium" style={{ color: "var(--color-muted-foreground)" }}>
              {role === "admin" ? "Admin" : "Staff"}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => signOut.mutate(undefined, { onSuccess: () => router.replace("/login") })}
          disabled={signOut.isPending}
          aria-label="Sign out"
          title="Sign out"
          className="flex items-center justify-center rounded-lg hover:bg-slate-50"
          style={{ width: 30, height: 30, color: "var(--color-muted-foreground)" }}
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
