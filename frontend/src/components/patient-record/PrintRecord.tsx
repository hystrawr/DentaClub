"use client";

import { Printer } from "lucide-react";
import { Suspense, useEffect, useMemo, useRef } from "react";
import PatientAppointmentsPage from "@/app/(frontdesk)/patients/[id]/appointments/page";
import PatientChartPage from "@/app/(frontdesk)/patients/[id]/chart/page";
import PatientConsentPage from "@/app/(frontdesk)/patients/[id]/consent/page";
import PatientInfoPage from "@/app/(frontdesk)/patients/[id]/info/page";
import PatientTreatmentPage from "@/app/(frontdesk)/patients/[id]/treatment/page";
import { RECORD_TABS } from "./RecordTabs";

const PAGES = {
  info: PatientInfoPage,
  consent: PatientConsentPage,
  chart: PatientChartPage,
  treatment: PatientTreatmentPage,
  appointments: PatientAppointmentsPage,
} as const;

/**
 * The one Print / Save as PDF button. Both are the browser's print dialog;
 * "Save as PDF" is a destination it offers there.
 */
export function PrintButton({ onClick, busy }: { onClick: () => void; busy?: boolean }) {
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={onClick}
      disabled={busy}
      title='To save a PDF, choose "Save as PDF" as the printer'
      data-print="hide"
    >
      <Printer size={13} aria-hidden="true" /> {busy ? "Preparing…" : "Print / Save as PDF"}
    </button>
  );
}

/**
 * Every section of the record, one after another, for printing — not only the
 * tab that is open. Hidden on screen; mounted only while printing.
 *
 * It waits until no section is still loading (or 10 seconds pass), writes
 * every field's value out as text (an input prints only what fits in its box,
 * so a long address would be cut off), opens the print dialog, and calls
 * `onDone` once the dialog closes.
 */
export function PrintRecord({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  const params = useMemo(() => Promise.resolve({ id: patientId }), [patientId]);
  const searchParams = useMemo(() => Promise.resolve({}), []);

  useEffect(() => {
    let cancelled = false;
    let timer: number;
    let unmirror = () => {};
    const started = Date.now();
    const finish = () => done.current();

    const tick = () => {
      if (cancelled) return;
      const loading = ref.current?.querySelector('[aria-busy="true"], .skeleton');
      if (loading && Date.now() - started < 10_000) {
        timer = window.setTimeout(tick, 200);
        return;
      }
      if (ref.current) unmirror = mirrorFields(ref.current);
      window.addEventListener("afterprint", finish, { once: true });
      window.print();
    };
    timer = window.setTimeout(tick, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", finish);
      unmirror();
    };
  }, []);

  return (
    <div ref={ref} className="print-record" aria-hidden="true">
      {RECORD_TABS.map((tab) => {
        const Page = PAGES[tab.href];
        return (
          <section key={tab.href} className="print-section">
            <h2 className="print-section-title">
              {tab.title}
            </h2>
            <Suspense fallback={<div className="skeleton" style={{ height: 120 }} />}>
              <Page params={params} searchParams={searchParams} />
            </Suspense>
          </section>
        );
      })}
    </div>
  );
}

const NOT_TEXT = new Set(["checkbox", "radio", "hidden", "file", "range", "button", "submit"]);

/**
 * Puts each field's value in a span after it, which the print rules show in
 * the field's place. Returns the undo. The spans sit inside elements React
 * owns, so they are removed before React unmounts the copy.
 */
function mirrorFields(root: HTMLElement): () => void {
  const spans: HTMLElement[] = [];
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea").forEach((field) => {
    if (field instanceof HTMLInputElement && NOT_TEXT.has(field.type)) return;
    const span = document.createElement("span");
    span.className = field.classList.contains("money") ? "print-value money" : "print-value";
    span.style.textAlign = field.style.textAlign;
    span.textContent = field instanceof HTMLSelectElement ? (field.value ? (field.selectedOptions[0]?.text ?? "") : "") : field.value;
    field.after(span);
    spans.push(span);
  });
  return () => spans.forEach((span) => span.remove());
}
