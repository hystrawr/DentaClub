"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/api/auth";

/** Services is for admins: staff who open its address are sent to the dashboard. */
export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();
  const isAdmin = user.data?.role === "admin";

  useEffect(() => {
    if (user.data && !isAdmin) router.replace("/dashboard");
  }, [user.data, isAdmin, router]);

  if (!isAdmin) return null;

  return (
    <div className="px-5 sm:px-10 lg:px-12 py-6 space-y-5">
      <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--color-foreground)" }}>
        Services
      </h1>
      {children}
    </div>
  );
}
