"use client";

import { use } from "react";
import { TreatmentSheet } from "@/components/patient-record/TreatmentSheet";
import { useTreatmentRecords } from "@/lib/api/treatment-records";

/** The Treatment Record tab. */
export default function PatientTreatmentPage({ params }: PageProps<"/patients/[id]/treatment">) {
  const { id } = use(params);
  const records = useTreatmentRecords(id);

  if (records.data) return <TreatmentSheet key={id} patientId={id} records={records.data} />;

  return (
    <div className="p-6">
      {records.isError ? (
        // Never an empty sheet on a failed read: saving it would wipe the record.
        <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
          The treatment record could not be loaded. Reload before editing — an empty sheet here is not an empty record.
        </p>
      ) : (
        <div className="skeleton" style={{ height: 320, borderRadius: 10 }} aria-busy="true" />
      )}
    </div>
  );
}
