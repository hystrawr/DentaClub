import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { del, get, patch, post, put } from "./client";
import type {
  MedicalHistory,
  MedicalHistoryAnswers,
  Patient,
  PatientListItem,
  RegisterPatientPayload,
  UpdatePatientPayload,
} from "@/types/api";

/* ─── List / search ─────────────────────────────────────────────── */

/**
 * Every patient, A–Z by last name, with their last visit and next appointment.
 * `search` narrows by name or mobile; `status: "inactive"` lists removed patients instead.
 */
export function usePatients(params?: { search?: string; status?: "active" | "inactive" }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["patients", "list", params?.search ?? "", params?.status ?? "active"],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (params?.search) qs.set("search", params.search);
      if (params?.status === "inactive") qs.set("status", "inactive");
      const query = qs.size > 0 ? `?${qs}` : "";
      return (await get<{ data: PatientListItem[] }>(`/api/patients${query}`)).data;
    },
    enabled: options?.enabled ?? true,
    // Keep the previous results on screen while the next search loads.
    placeholderData: (previous) => previous,
  });
}

/* ─── Single patient ────────────────────────────────────────────── */

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: ["patients", id],
    queryFn: async () => (await get<{ data: Patient }>(`/api/patients/${id}`)).data,
    enabled: Boolean(id),
  });
}

/* ─── Create / update ───────────────────────────────────────────── */

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RegisterPatientPayload) =>
      (await post<{ data: Patient }>("/api/patients", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
}

/** Whether a patient by this name is already on file (capitals and spacing aside). */
export async function checkPatientName(name: { first_name: string; middle_name: string; last_name: string }) {
  const qs = new URLSearchParams({ first_name: name.first_name, last_name: name.last_name });
  if (name.middle_name.trim()) qs.set("middle_name", name.middle_name);
  return (await get<{ data: { exists: false } | { exists: true; id: string; full_name: string } }>(`/api/patients/name-check?${qs}`)).data;
}

/** Partial update: an absent key is untouched, `null` clears the field. */
export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePatientPayload) =>
      (await patch<{ data: Patient }>(`/api/patients/${id}`, payload)).data,
    onSuccess: (patient) => {
      qc.setQueryData(["patients", id], patient);
      void qc.invalidateQueries({ queryKey: ["patients", "list"] });
    },
  });
}

/** Takes the patient out of the directory; their chart, consents, documents and appointments are kept. */
export function useDeletePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => del<void>(`/api/patients/${id}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["patients", id] });
      void qc.invalidateQueries({ queryKey: ["patients", "list"] });
    },
  });
}
/** Puts a removed patient back in the directory (admins only). */
export function useRestorePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await post<{ data: Patient }>(`/api/patients/${id}/restore`)).data,
    onSuccess: (patient) => {
      qc.setQueryData(["patients", id], patient);
      void qc.invalidateQueries({ queryKey: ["patients", "list"] });
    },
  });
}

/* ─── Medical history ───────────────────────────────────────────── */

export function useMedicalHistory(patientId: string) {
  return useQuery({
    queryKey: ["medical-history", patientId],
    queryFn: async () => (await get<{ data: MedicalHistory }>(`/api/patients/${patientId}/medical-history`)).data,
  });
}

/** Saves the whole form: every answer is sent, `null` for not asked. */
export function useSaveMedicalHistory(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (answers: MedicalHistoryAnswers) =>
      (await put<{ data: MedicalHistory }>(`/api/patients/${patientId}/medical-history`, answers)).data,
    onSuccess: (history) => qc.setQueryData(["medical-history", patientId], history),
  });
}
