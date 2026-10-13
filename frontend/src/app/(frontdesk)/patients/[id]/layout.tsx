"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useState } from "react";
import { PatientHero } from "@/components/patient-record/PatientHero";
import { PrintButton, PrintRecord } from "@/components/patient-record/PrintRecord";
import { RECORD_TABS, RecordTabs } from "@/components/patient-record/RecordTabs";
import { usePatient } from "@/lib/api/patients";

/**
 * The patient record: photo and name, folder tabs, and the panel the active
 * tab's page fills. Print / Save as PDF prints every tab, not only the open one.
 *
 * If the patient cannot be loaded, a red banner says so above everything —
 * nothing below is complete, and the page must not look as if it were.
 */
export default function PatientRecordLayout({ children, params }: LayoutProps<"/patients/[id]">) {
  const { id } = use(params);
  const pathname = usePathname();
  const { data: patient, isLoading, isError } = usePatient(id);
  const [printing, setPrinting] = useState(false);

  const active = RECORD_TABS.find((tab) => {
    const href = `/patients/${id}/${tab.href}`;
    return pathname === href || pathname.startsWith(href + "/");
  });

  return (
    <div className="px-4 sm:px-8 py-6 w-full h-full flex flex-col">
      {isError && (
        <div
          role="alert"
          className="mb-4 rounded-lg px-4 py-2 text-xs font-medium"
          style={{ background: "#FEE2E2", color: "#991B1B", border: "1px solid #FCA5A5" }}
        >
          This patient&apos;s record could not be loaded. Nothing below is complete — reload before relying on it.
        </div>
      )}

      <Link
        href={"/patients" as Route}
        className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 hover:text-blue-600"
        style={{ color: "var(--color-subtle-foreground)" }}
        data-print="hide"
      >
        ← All patients
      </Link>

      <PatientHero
        patient={patient}
        loading={isLoading}
        actions={<PrintButton onClick={() => setPrinting(true)} busy={printing} />}
      />

      <div className="flex items-end mt-6 shrink-0" data-print="hide">
        <RecordTabs patientId={id} active={active} />
      </div>

      {/* While printing, the open tab gives way to the whole record below. */}
      <section className="record-panel" aria-label={active?.title} data-print={printing ? "hide" : undefined}>
        {children}
      </section>

      {printing && <PrintRecord patientId={id} onDone={() => setPrinting(false)} />}
    </div>
  );
}
