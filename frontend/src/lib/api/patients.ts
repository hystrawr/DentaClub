import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post, put } from "./client";
import type {
  CreatePatientPayload,
  MedicalHistory,
  MedicalHistoryAnswers,
  Patient,
  PatientSummary,
  UpdatePatientPayload,
} from "@/types/api";

/* ─── List / search ─────────────────────────────────────────────── */

/** Every patient, A–Z by last name. `search` narrows by name or mobile. */
export function usePatients(params?: { search?: string }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["patients", "list", params?.search ?? ""],
    queryFn: async () => {
      const qs = params?.search ? `?search=${encodeURIComponent(params.search)}` : "";
      return (await get<{ data: PatientSummary[] }>(`/api/patients${qs}`)).data;
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
    mutationFn: async (payload: CreatePatientPayload) =>
      (await post<{ data: Patient }>("/api/patients", payload)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patients"] }),
  });
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
