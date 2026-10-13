import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, put } from "./client";
import type { TreatmentRecord, TreatmentRow } from "@/types/api";

/** The Treatment Record sheet, top to bottom. */
export function useTreatmentRecords(patientId: string) {
  return useQuery({
    queryKey: ["treatment-records", patientId],
    queryFn: async () =>
      (await get<{ data: TreatmentRecord[] }>(`/api/patients/${patientId}/treatment-records`)).data,
  });
}

/** Saves the whole sheet; blank rows are dropped. An empty list clears it. */
export function useSaveTreatmentRecords(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: TreatmentRow[]) =>
      (await put<{ data: TreatmentRecord[] }>(`/api/patients/${patientId}/treatment-records`, { rows })).data,
    onSuccess: (records) => qc.setQueryData(["treatment-records", patientId], records),
  });
}
