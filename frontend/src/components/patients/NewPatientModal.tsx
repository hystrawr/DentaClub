"use client";

import { PatientInfoForm } from "@/components/patient-record/PatientInfoForm";

/**
 * Register a patient with the full Patient Information Record — the same form
 * as a patient's Information tab, empty. On success it opens the new patient's
 * Information tab.
 *
 * The backdrop does not close it: a misclick would lose a whole form's
 * answers. Cancel asks first, in an in-app dialog, when anything was typed.
 */
export function NewPatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)" }} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="New Patient" className="fixed z-50 inset-0 flex items-center justify-center p-2 sm:p-4">
        <div className="record-panel w-full max-w-6xl flex flex-col" style={{ maxHeight: "94vh", flex: "none", marginTop: 0, borderRadius: "var(--radius-xl)", overflow: "hidden" }}>
          <PatientInfoForm patient={null} onCancel={onClose} />
        </div>
      </div>
    </>
  );
}
