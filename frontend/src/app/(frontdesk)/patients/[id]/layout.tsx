"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { use, useState } from "react";
import { PatientHero } from "@/components/patient-record/PatientHero";
import { PrintButton, PrintRecord } from "@/components/patient-record/PrintRecord";
import { RECORD_TABS, RecordTabs } from "@/components/patient-record/RecordTabs";
import { useCurrentUser } from "@/lib/api/auth";
import { usePatient, useRestorePatient } from "@/lib/api/patients";

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
  const user = useCurrentUser();
  const restore = useRestorePatient(id);
  const inactive = patient?.is_active === false;
  const [printing, setPrinting] = useState(false);

  const active = RECORD_TABS.find((tab) => {
    const href = `/patients/${id}/${tab.href}`;
    return pathname === href || pathname.startsWith(href + "/");
  });

  return (
    <div className="px-5 sm:px-10 lg:px-12 py-6 w-full h-full flex flex-col">
      {isError && (
        <div
          role="alert"
          className="mb-4 rounded-lg px-4 py-2 text-xs font-medium"
          style={{ background: "var(--color-destructive-light)", color: "var(--color-destructive)", border: "1px solid #F2AEA5" }}
        >
          This patient&apos;s record could not be loaded. Nothing below is complete — reload before relying on it.
        </div>
      )}
      {inactive && (
        <div
          role="status"
          className="mb-4 rounded-lg px-4 py-2 text-xs font-medium flex items-center gap-3 flex-wrap"
          style={{ background: "var(--color-warning-light)", color: "var(--color-warning)", border: "1px solid #EBC48C" }}
          data-print="hide"
        >
          <span className="mr-auto">
            This patient was removed from the directory. Their records are kept for reference and can&apos;t be changed.
          </span>
          {restore.error && <span>{restore.error.message}</span>}
          {user.data?.role === "admin" && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => restore.mutate()} disabled={restore.isPending}>
              {restore.isPending ? "Restoring…" : "Restore patient"}
            </button>
          )}
        </div>
      )}

      <Link
        href={"/patients" as Route}
        className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 hover:text-[var(--color-primary)]"
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
        {/* An inactive patient's record is for reading: every input and button inside is switched off. */}
        <fieldset disabled={inactive} className="contents">
          {children}
        </fieldset>
      </section>

      {printing && <PrintRecord patientId={id} onDone={() => setPrinting(false)} />}
    </div>
  );
}
