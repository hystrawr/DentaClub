"use client";

import { use } from "react";
import { PatientInfoForm } from "@/components/patient-record/PatientInfoForm";
import { useMedicalHistory, usePatient } from "@/lib/api/patients";

/** The Patient Information Record tab. */
export default function PatientInfoPage({ params }: PageProps<"/patients/[id]/info">) {
  const { id } = use(params);
  const patient = usePatient(id);
  const history = useMedicalHistory(id);

  if (patient.data && history.data) {
    return <PatientInfoForm key={id} patient={patient.data} history={history.data} />;
  }

  return (
    <div className="p-6">
      {patient.isError || history.isError ? (
        // Never an empty form on a failed read: saving it would wipe the record.
        <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
          The patient information could not be loaded. Reload before editing — an empty form here is not an empty record.
        </p>
      ) : (
        <div className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: 180, borderRadius: 10 }} />
          ))}
        </div>
      )}
    </div>
  );
}
