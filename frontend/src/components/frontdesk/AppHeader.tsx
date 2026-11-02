"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useCurrentUser, useSignOut } from "@/lib/api/auth";

/** The bar across the top of every front-desk page: the wordmark on the left, who's signed in on the right. */
export function AppHeader() {
  const router = useRouter();
  const user = useCurrentUser();
  const signOut = useSignOut();
  const username = user.data?.username ?? "";
  const role = user.data?.role;

  return (
    <header
      // Logo lines up with the rail (24px); the user chip with the page's right margin.
      className="flex items-center justify-between gap-4 px-5 sm:pl-6 sm:pr-10 lg:pr-12 shrink-0"
      style={{
        height: "var(--header-height)",
        background: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <Link href="/dashboard" aria-label="The DentaClub, go to the dashboard" className="flex items-center shrink-0">
        {/* The wordmark is 3:1; 40px tall on desktop, 32px on a phone, so its script "The" stays legible. */}
        <Image
          src="/brand/wordmark.svg"
          alt="The DentaClub"
          width={120}
          height={40}
          priority
          unoptimized
          className="h-8 w-auto sm:h-10"
        />
      </Link>

      <div
        className="flex items-center gap-2.5 rounded-full p-1 sm:pr-1.5"
        style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
      >
        <div
          className="flex items-center justify-center rounded-full text-xs font-bold uppercase shrink-0"
          style={{ width: 30, height: 30, background: "var(--color-primary-light)", color: "var(--color-primary)" }}
          aria-hidden="true"
        >
          {username.slice(0, 1)}
        </div>
        <span className="hidden sm:flex flex-col leading-tight min-w-0">
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
          aria-label={`Sign out ${username}`}
          title="Sign out"
          className="flex items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-subtle)]"
          style={{ width: 30, height: 30, color: "var(--color-muted-foreground)" }}
        >
          <LogOut size={15} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
