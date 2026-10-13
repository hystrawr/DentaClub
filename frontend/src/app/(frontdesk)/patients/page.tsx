"use client";

import { useState } from "react";
import { PatientList } from "@/components/frontdesk/PatientList";
import { NewPatientModal } from "@/components/frontdesk/NewPatientModal";

export default function PatientsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="px-4 sm:px-8 py-6">
      <PatientList onAddPatient={() => setModalOpen(true)} />
      <NewPatientModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
