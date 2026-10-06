import { redirect } from "next/navigation";

/** The front desk opens on the patient directory. */
export default function Home() {
  redirect("/patients");
}
