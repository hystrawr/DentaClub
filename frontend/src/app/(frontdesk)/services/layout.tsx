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

  // As tall as the screen, like Appointments: the title stays put and the table scrolls inside its card.
  return <div className="h-full flex flex-col gap-5 px-5 sm:px-10 lg:px-12 py-6">{children}</div>;
}
