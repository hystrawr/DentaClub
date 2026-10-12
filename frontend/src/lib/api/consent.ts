import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL, get, post } from "./client";
import type { ConsentForm, PatientConsent, SignConsentPayload } from "@/types/api";

// The clinic's consent form and each patient's signed copy.

export function useConsentForm() {
  return useQuery({
    queryKey: ["consent-form"],
    queryFn: async () => (await get<{ data: ConsentForm }>("/api/consent-form")).data,
  });
}

export function usePatientConsent(patientId: string) {
  return useQuery({
    queryKey: ["consent", patientId],
    queryFn: async () => (await get<{ data: PatientConsent }>(`/api/patients/${patientId}/consent`)).data,
  });
}

export function useSignConsent(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SignConsentPayload) =>
      (await post<{ data: PatientConsent }>(`/api/patients/${patientId}/consent`, payload)).data,
    onSuccess: (data) => qc.setQueryData(["consent", patientId], data),
  });
}

/** Where a signed PDF is served, inline in the browser. */
export const documentFileUrl = (documentId: string) => `${API_URL}/api/documents/${documentId}/file`;
