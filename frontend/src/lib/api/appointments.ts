import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "./client";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  AppointmentTypePayload,
  CreateAppointmentPayload,
  Operatory,
  Provider,
  Slot,
} from "@/types/api";

// Ported from DentalOS lib/api/appointments.ts, plus the clinic-structure reads
// the booking form needs.

/* ─── List ──────────────────────────────────────────────────────── */

export function useAppointments(params: {
  date?: string;
  date_from?: string;
  date_to?: string;
  patient_id?: string;
  status?: AppointmentStatus;
}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
      return (await get<{ data: Appointment[] }>(`/api/appointments?${qs}`)).data;
    },
    enabled: options?.enabled ?? true,
    placeholderData: (previous) => previous,
    refetchInterval: 30_000,
  });
}

export function useAppointment(id: string | undefined | null) {
  return useQuery({
    queryKey: ["appointments", "one", id],
    queryFn: async () => (await get<{ data: Appointment }>(`/api/appointments/${id}`)).data,
    enabled: Boolean(id),
  });
}

/* ─── Writes ────────────────────────────────────────────────────── */

/** Everything that shows an appointment's status: the calendar, the detail panel, the patient list. */
function useInvalidateSchedule() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["appointments"] });
    void qc.invalidateQueries({ queryKey: ["slots"] });
    void qc.invalidateQueries({ queryKey: ["patients", "list"] });
  };
}

export function useCreateAppointment() {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) =>
      (await post<{ data: Appointment }>("/api/appointments", payload)).data,
    onSuccess: invalidate,
  });
}

/**
 * Move an appointment through the status machine. The API refuses an illegal
 * hop (422) and a double-booking (409, naming the appointment in the way), so
 * this does not re-implement the rules.
 */
export function useUpdateAppointmentStatus(id: string) {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: async ({ status, cancellation_reason }: { status: AppointmentStatus; cancellation_reason?: string }) =>
      patch<{ data: Appointment }>(`/api/appointments/${id}/status`, {
        status,
        ...(cancellation_reason ? { cancellation_reason } : {}),
      }),
    onSuccess: invalidate,
  });
}

/**
 * Move an appointment to a new time (and chair). The dentist stays. A confirmed
 * appointment is checked for double-booking; the 409 names the clash.
 */
export function useRescheduleAppointment(id: string) {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: async (payload: { scheduled_start: string; scheduled_end: string; operatory_id: string | null }) =>
      (await patch<{ data: Appointment }>(`/api/appointments/${id}`, payload)).data,
    onSuccess: invalidate,
  });
}

/* ─── Clinic structure ──────────────────────────────────────────── */

export function useProviders() {
  return useQuery({
    queryKey: ["providers"],
    queryFn: async () => (await get<{ data: Provider[] }>("/api/providers")).data,
    staleTime: 60_000,
  });
}

export function useAppointmentTypes() {
  return useQuery({
    queryKey: ["appointment-types"],
    queryFn: () => get<AppointmentType[]>("/api/appointment-types"),
    staleTime: 60_000,
  });
}

/** Add a service (no id) or change one. Booking and the Treatment sheet read the same list. */
export function useSaveAppointmentType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: AppointmentTypePayload & { id?: string }) =>
      id
        ? patch<AppointmentType>(`/api/appointment-types/${id}`, payload)
        : post<AppointmentType>("/api/appointment-types", payload),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["appointment-types"] }),
  });
}

export function useOperatories() {
  return useQuery({
    queryKey: ["operatories"],
    queryFn: async () => (await get<{ data: Operatory[] }>("/api/operatories?active=1")).data,
    staleTime: 60_000,
  });
}

/** A dentist's free start times on a date, in `slotMinutes` steps. */
export function useSlots(providerId: string | undefined, date: string | undefined, slotMinutes = 15) {
  return useQuery({
    queryKey: ["slots", providerId, date, slotMinutes],
    queryFn: async () =>
      (await get<{ data: Slot[] }>(`/api/providers/${providerId}/slots?date=${date}&slot_minutes=${slotMinutes}`)).data,
    enabled: Boolean(providerId && date),
  });
}

