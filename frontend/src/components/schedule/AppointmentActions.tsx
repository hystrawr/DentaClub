"use client";

import { useState } from "react";
import { Ban, Check, CheckCircle, Play, UserCheck, UserX } from "lucide-react";
import { ApiError } from "@/lib/api/client";
import { useUpdateAppointmentStatus } from "@/lib/api/appointments";
import { CAN_CANCEL, CAN_NO_SHOW, NEXT_ACTION } from "@/lib/utils/appointment-status";
import { timeOf } from "@/lib/utils/manila";
import type { Appointment } from "@/types/api";

/**
 * The buttons that move an appointment along, shared by the schedule's detail
 * panel and the chairside sheet.
 *
 * DentalOS's schedule panel had no actions at all — a receptionist could see
 * an appointment and do nothing with it. The rules stay on the server: a 422
 * (illegal hop) or 409 (double-booking) comes back as a message here, and a
 * 409 names the appointment that is in the way.
 */
export function AppointmentActions({ appointment, size = "md" }: { appointment: Appointment; size?: "md" | "lg" }) {
  const transition = useUpdateAppointmentStatus(appointment.id);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");

  const next = NEXT_ACTION[appointment.status];
  const canCancel = CAN_CANCEL.includes(appointment.status);
  const canNoShow = CAN_NO_SHOW.includes(appointment.status);
  const height = size === "lg" ? 52 : 40;

  function run(status: Parameters<typeof transition.mutate>[0]["status"], cancellation_reason?: string) {
    transition.mutate(
      { status, cancellation_reason },
      {
        onSuccess: () => {
          setCancelling(false);
          setReason("");
        },
      },
    );
  }

  const conflict = transition.error instanceof ApiError && transition.error.status === 409
    ? (transition.error.body as { conflicting_appointment?: { scheduled_start: string; scheduled_end: string } } | undefined)?.conflicting_appointment
    : undefined;

  const icon = next?.to === "completed" ? <CheckCircle size={17} />
    : next?.to === "in_chair" ? <Play size={17} strokeWidth={2.5} />
    : next?.to === "arrived" ? <UserCheck size={17} />
    : <Check size={17} />;

  return (
    <div className="flex flex-col gap-2">
      {next && (
        <button
          type="button"
          onClick={() => run(next.to)}
          disabled={transition.isPending}
          className="btn-gradient flex items-center justify-center gap-2 font-semibold disabled:opacity-40"
          style={{ minHeight: height, borderRadius: 14, fontSize: "0.9rem" }}
        >
          {icon}
          {transition.isPending ? "Working…" : next.label}
        </button>
      )}

      {(canCancel || canNoShow) && !cancelling && (
        <div className="flex gap-2">
          {canNoShow && (
            <button
              type="button"
              className="btn btn-secondary flex-1"
              disabled={transition.isPending}
              onClick={() => run("no_show")}
            >
              <UserX size={14} /> No-show
            </button>
          )}
          {canCancel && (
            <button type="button" className="btn btn-danger flex-1" disabled={transition.isPending} onClick={() => setCancelling(true)}>
              <Ban size={14} /> Cancel
            </button>
          )}
        </div>
      )}

      {cancelling && (
        <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--color-destructive-light)" }}>
          <input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this being cancelled?"
            aria-label="Cancellation reason"
            className="w-full h-9 rounded-lg px-3 text-sm outline-none field-focus"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCancelling(false)}>
              Keep appointment
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={!reason.trim() || transition.isPending}
              onClick={() => run("cancelled", reason.trim())}
            >
              Cancel appointment
            </button>
          </div>
        </div>
      )}

      {transition.error && (
        <p className="text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
          {transition.error instanceof Error ? transition.error.message : "That action could not be completed."}
          {conflict && ` It overlaps the appointment at ${timeOf(conflict.scheduled_start)}–${timeOf(conflict.scheduled_end)}.`}
        </p>
      )}
    </div>
  );
}
