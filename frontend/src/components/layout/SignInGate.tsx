"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Route } from "next";
import { useCurrentUser } from "@/lib/api/auth";

/**
 * Shows the clinic screens only once someone is signed in, and sends everyone
 * else to the sign-in page. This is for the screen only — the real protection
 * is the API, which refuses every request without a valid sign-in.
 */
export function SignInGate({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (user.data === null) router.replace(`/login?next=${encodeURIComponent(pathname)}` as Route);
  }, [user.data, router, pathname]);

  if (user.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
          {user.error instanceof Error ? user.error.message : "Could not check who is signed in."}
        </p>
      </div>
    );
  }

  // Nothing — not even the sidebar — until the sign-in is confirmed.
  if (!user.data) return <div className="min-h-screen" style={{ background: "var(--color-canvas)" }} aria-busy="true" />;

  return children;
}
