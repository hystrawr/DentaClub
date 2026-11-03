import type { Route } from "next";
import { redirect } from "next/navigation";

/** /patients/:id opens on the Patient Information Record. */
export default async function PatientIndex({ params }: PageProps<"/patients/[id]">) {
  const { id } = await params;
  redirect(`/patients/${id}/info` as Route);
}
