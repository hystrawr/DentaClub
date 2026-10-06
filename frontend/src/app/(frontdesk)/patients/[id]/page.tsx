import type { Route } from "next";
import { redirect } from "next/navigation";

/** /patients/:id opens on the overview tab. */
export default async function PatientIndex({ params }: PageProps<"/patients/[id]">) {
  const { id } = await params;
  redirect(`/patients/${id}/overview` as Route);
}
