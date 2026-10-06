import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, patch, post } from "./client";
import type {
  Appointment,
  AppointmentStatus,
  AppointmentType,
  ChairsideBoard,
  ConfirmIntake,
  CreateAppointmentPayload,
  Operatory,
  Provider,
  Slot,
} from "@/types/api";

// Ported from DentalOS lib/api/appointments.ts, plus the clinic-structure reads
// the booking form needs.

/* ─── List ──────────────────────────────────────────────────────── */

export function useAppointments(params: { date?: string; date_from?: string; date_to?: string; patient_id?: string }) {
  return useQuery({
    queryKey: ["appointments", params],
    queryFn: async () => {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) if (value) qs.set(key, value);
      return (await get<{ data: Appointment[] }>(`/api/appointments?${qs}`)).data;
    },
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

/** Everything that shows an appointment's status: the calendar, the detail panel, the board. */
function useInvalidateSchedule() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["appointments"] });
    void qc.invalidateQueries({ queryKey: OPERATORY_BOARD_KEY });
    void qc.invalidateQueries({ queryKey: ["slots"] });
    // Confirming mints a consent link, which appears on the patient's Consent tab.
    void qc.invalidateQueries({ queryKey: ["intake", "submissions"] });
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
 * this does not re-implement the rules. Confirming also returns the consent
 * link it minted for the patient.
 */
export function useUpdateAppointmentStatus(id: string) {
  const invalidate = useInvalidateSchedule();
  return useMutation({
    mutationFn: async ({ status, cancellation_reason }: { status: AppointmentStatus; cancellation_reason?: string }) =>
      patch<{ data: Appointment; intake?: ConfirmIntake }>(`/api/appointments/${id}/status`, {
        status,
        ...(cancellation_reason ? { cancellation_reason } : {}),
      }),
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

/* ─── Operatory board (the queue) ───────────────────────────────── */

/** One key for the board, so every write that changes it can invalidate it. */
const OPERATORY_BOARD_KEY = ["operatory-board", "today"] as const;

export function useTodayOperatoryBoard() {
  return useQuery({
    queryKey: OPERATORY_BOARD_KEY,
    queryFn: () => get<ChairsideBoard>("/api/chairside/board"),
    // Thirty seconds is the board's contract with the chair (DentalOS rule #4).
    refetchInterval: 30_000,
  });
}

