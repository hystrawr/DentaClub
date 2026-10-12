"use client";

import { useState } from "react";
import { TopHeader } from "@/components/frontdesk/TopHeader";
import { PatientDirectory } from "@/components/frontdesk/PatientDirectory";
import { NewPatientModal } from "@/components/frontdesk/NewPatientModal";

export default function PatientsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <TopHeader title="Patients"  ctaLabel="New Patient" onCta={() => setModalOpen(true)} />
      <div className="p-6">
        <PatientDirectory onAddPatient={() => setModalOpen(true)} />
      </div>
      <NewPatientModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
