"use client";

import type { Route } from "next";
import Link from "next/link";
import { CalendarDays, FileSignature, IdCard, Table2 } from "lucide-react";

/** lucide has no tooth, so it is drawn here — the same outline the preview used. */
function ToothIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 3c-2.5 0-4 2-4 4.5 0 2 1 3.5 1.5 6S5 21 7 21c1.5 0 1.5-5 3-5h4c1.5 0 1.5 5 3 5 2 0 2-5 2.5-7.5S21 9.5 21 7.5C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z" />
    </svg>
  );
}

/**
 * The record's sections, in the paper form's order. `title` is the section's
 * full name, used as its heading when the whole record is printed.
 */
export const RECORD_TABS = [
  { href: "info", label: "Information", title: "Patient Information Record", icon: IdCard },
  { href: "consent", label: "Consent", title: "Informed Consent", icon: FileSignature },
  { href: "chart", label: "Dental Chart", title: "Dental Record Chart", icon: ToothIcon },
  { href: "treatment", label: "Treatment", title: "Treatment Record", icon: Table2 },
  { href: "appointments", label: "Appointments", title: "Appointments", icon: CalendarDays },
] as const;

export type RecordTab = (typeof RECORD_TABS)[number];

/** Folder tabs that sit on top of the record panel; the active one joins it. */
export function RecordTabs({ patientId, active }: { patientId: string; active?: RecordTab }) {
  return (
    <nav className="flex items-end pl-1 min-w-0" aria-label="Patient record sections">
      {RECORD_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = tab.href === active?.href;
        return (
          <Link
            key={tab.href}
            href={`/patients/${patientId}/${tab.href}` as Route}
            className="record-tab"
            aria-current={isActive ? "page" : undefined}
            title={tab.title}
          >
            <Icon size={16} />
            <span className={isActive ? undefined : "hidden md:inline"}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
