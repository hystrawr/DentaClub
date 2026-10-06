import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { API_URL, del, get, patch, post } from "./client";
import type {
  GuardianLink,
  GuardianRelationship,
  IntakeLink,
  IntakePacket,
  IntakeSubmission,
  PatientDocument,
} from "@/types/api";

// The staff side of consent: packets, links, submissions, signed documents and
// guardians.

export function usePackets() {
  return useQuery({
    queryKey: ["intake", "packets"],
    queryFn: async () => (await get<{ data: IntakePacket[] }>("/api/intake/packets")).data,
    staleTime: 60_000,
  });
}

export function usePatientSubmissions(patientId: string) {
  return useQuery({
    queryKey: ["intake", "submissions", patientId],
    queryFn: async () =>
      (await get<{ data: IntakeSubmission[] }>(`/api/intake/submissions?patient_id=${encodeURIComponent(patientId)}&per_page=100`)).data,
    // A patient may be filling the form in the waiting room right now.
    refetchInterval: 15_000,
  });
}

/** Mint a link. The token is shown once — the server keeps only its hash. */
export function useMintIntakeLink(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (packetId: string) =>
      (await post<{ data: IntakeLink }>("/api/intake/links", { patient_id: patientId, packet_id: packetId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intake", "submissions", patientId] }),
  });
}

export function usePatientDocuments(patientId: string) {
  return useQuery({
    queryKey: ["documents", patientId],
    queryFn: async () => (await get<{ data: PatientDocument[] }>(`/api/patients/${patientId}/documents`)).data,
    refetchInterval: 15_000,
  });
}

/** Where the signed PDF is served, inline in the browser. */
export const documentFileUrl = (documentId: string) => `${API_URL}/api/documents/${documentId}/file`;

/* ─── Guardians ─────────────────────────────────────────────────── */

export function useGuardianLinks(patientId: string) {
  return useQuery({
    queryKey: ["guardian-links", patientId],
    queryFn: async () =>
      (await get<{ data: GuardianLink[] }>(`/api/guardian-links?patient_id=${encodeURIComponent(patientId)}`)).data,
  });
}

function useInvalidateGuardians() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["guardian-links"] });
}

export function useCreateGuardianLink() {
  const invalidate = useInvalidateGuardians();
  return useMutation({
    mutationFn: async (input: {
      guardian_patient_id: string;
      ward_patient_id: string;
      relationship: GuardianRelationship;
      consent_authority_flag: boolean;
    }) => (await post<{ data: GuardianLink }>("/api/guardian-links", input)).data,
    onSuccess: invalidate,
  });
}

export function useUpdateGuardianLink() {
  const invalidate = useInvalidateGuardians();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; consent_authority_flag?: boolean; relationship?: GuardianRelationship }) =>
      (await patch<{ data: GuardianLink }>(`/api/guardian-links/${id}`, input)).data,
    onSuccess: invalidate,
  });
}

export function useDeleteGuardianLink() {
  const invalidate = useInvalidateGuardians();
  return useMutation({
    mutationFn: async (id: string) => del(`/api/guardian-links/${id}`),
    onSuccess: invalidate,
  });
}
