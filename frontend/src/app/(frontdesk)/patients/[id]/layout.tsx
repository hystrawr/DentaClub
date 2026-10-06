"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use } from "react";
import { PatientHeaderBar } from "@/components/shared/PatientHeaderBar";
import { usePatient } from "@/lib/api/patients";
import { cn } from "@/lib/utils/cn";

/** Sub-nav tabs. Each tab is added as its feature is built — no tab leads nowhere. */
const TABS = [
  { label: "Overview", href: "overview" },
  { label: "Chart", href: "chart" },
  { label: "Appointments", href: "appointments" },
  { label: "Consent", href: "consent" },
];

/**
 * The patient chart shell (from DentalOS): identity bar, section tabs, content.
 *
 * If the patient cannot be loaded, a red banner says so above everything —
 * nothing below is complete, and the page must not look as if it were.
 */
export default function PatientDetailLayout({ children, params }: LayoutProps<"/patients/[id]">) {
  const { id } = use(params);
  const pathname = usePathname();
  const { data: patient, isLoading, isError } = usePatient(id);

  return (
    <div className="flex flex-col h-full">
      {isError && (
        <div
          role="alert"
          className="px-6 py-2 text-xs font-medium shrink-0"
          style={{ background: "#FEE2E2", color: "#991B1B", borderBottom: "1px solid #FCA5A5" }}
        >
          This patient&apos;s record could not be loaded. Nothing below is complete — reload before relying on it.
        </div>
      )}

      <PatientHeaderBar
        name={patient?.full_name}
        dateOfBirth={patient?.date_of_birth ?? undefined}
        age={patient?.age ?? undefined}
        isMinor={patient?.is_minor}
        loading={isLoading}
      />

      <nav
        className="flex items-end gap-1 px-6 shrink-0 overflow-x-auto"
        style={{ background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)" }}
        aria-label="Patient sections"
      >
        <Link
          href={"/patients" as Route}
          className="px-3 py-2.5 text-xs font-semibold mr-2"
          style={{ color: "var(--color-subtle-foreground)" }}
        >
          ← Directory
        </Link>
        {TABS.map((tab) => {
          const fullHref = `/patients/${id}/${tab.href}`;
          const isActive = pathname === fullHref || pathname.startsWith(fullHref + "/");
          return (
            <Link
              key={tab.href}
              href={fullHref as Route}
              className={cn(
                "px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                isActive ? "border-blue-600" : "border-transparent hover:border-slate-300",
              )}
              style={{ color: isActive ? "var(--color-primary)" : "var(--color-muted-foreground)", marginBottom: -1 }}
              aria-current={isActive ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1 overflow-y-auto" style={{ background: "var(--color-canvas)" }}>
        {children}
      </div>
    </div>
  );
}
