import { Router } from "express";
import { z } from "zod";
import { ruleViolation } from "../lib/http-error.js";
import * as appointments from "../services/scheduling/appointments.js";
import { appointmentResource } from "../services/scheduling/mapper.js";

// Ported from DentalOS apps/api/src/scheduling/appointment.controller.ts.
// Mounted at /api.
export const appointmentsRouter = Router();

const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "arrived",
  "in_chair",
  "completed",
  "cancelled",
  "no_show",
] as const;

/** Every status except `scheduled`, which is only ever the starting point. */
const TRANSITIONABLE = APPOINTMENT_STATUSES.filter((s) => s !== "scheduled") as [
  Exclude<(typeof APPOINTMENT_STATUSES)[number], "scheduled">,
  ...Exclude<(typeof APPOINTMENT_STATUSES)[number], "scheduled">[],
];

const isoDateTime = (field: string) =>
  z.iso.datetime({ offset: true, message: `The ${field} field must be a valid date.` });

const createAppointment = z.object({
  provider_profile_id: z.string().min(1, "The provider profile id field is required."),
  scheduled_start: isoDateTime("scheduled start"),
  scheduled_end: isoDateTime("scheduled end"),
  patient_id: z.string().nullish(),
  appointment_type_id: z.string().nullish(),
  operatory_id: z.string().nullish(),
  notes: z.string().max(2000, "The notes field must not be greater than 2000 characters.").nullish(),
});

const updateAppointment = z.object({
  scheduled_start: isoDateTime("scheduled start").optional(),
  scheduled_end: isoDateTime("scheduled end").optional(),
  notes: z.string().max(2000).nullish(),
  operatory_id: z.string().nullish(),
});

const updateStatus = z.object({
  status: z.enum(TRANSITIONABLE, "The selected status is invalid."),
  cancellation_reason: z
    .string()
    .max(500, "The cancellation reason field must not be greater than 500 characters.")
    .nullish(),
});

const cancelAppointment = z.object({
  cancellation_reason: z.string().min(1, "The cancellation reason field is required."),
});

const queryString = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

/** GET /api/appointments?date=…|date_from=…&date_to=…&provider_id=…&status=…&operatory_id=…&patient_id=… */
appointmentsRouter.get("/appointments", async (req, res) => {
  const query = req.query;
  const rows = await appointments.list({
    date: queryString(query.date),
    date_from: queryString(query.date_from),
    date_to: queryString(query.date_to),
    provider_id: queryString(query.provider_id),
    status: queryString(query.status),
    operatory_id: queryString(query.operatory_id),
    patient_id: queryString(query.patient_id),
  });
  res.json({ data: rows.map((row) => appointmentResource(row)) });
});

/** POST /api/appointments — book. */
appointmentsRouter.post("/appointments", async (req, res) => {
  const dto = createAppointment.parse(req.body);
  res.status(201).json({ data: appointmentResource(await appointments.book(dto)) });
});

appointmentsRouter.get("/appointments/:id", async (req, res) => {
  res.json({ data: appointmentResource(await appointments.findOrFail(req.params.id)) });
});

/** PATCH /api/appointments/:id — reschedule or annotate. */
appointmentsRouter.patch("/appointments/:id", async (req, res) => {
  const dto = updateAppointment.parse(req.body);
  res.json({ data: appointmentResource(await appointments.update(req.params.id, dto)) });
});

/** DELETE /api/appointments/:id — cancel (with a reason). The row is kept. */
appointmentsRouter.delete("/appointments/:id", async (req, res) => {
  const dto = cancelAppointment.parse(req.body ?? {});
  await appointments.cancel(req.params.id, dto.cancellation_reason);
  res.status(204).end();
});

/**
 * PATCH /api/appointments/:id/status — move through the status machine.
 *
 * `confirmed` goes through `confirm`, which refuses a double-booking.
 */
appointmentsRouter.patch("/appointments/:id/status", async (req, res) => {
  const dto = updateStatus.parse(req.body);

  if (dto.status === "cancelled" && !dto.cancellation_reason) {
    throw ruleViolation("Validation failed.", {
      cancellation_reason: ["The cancellation reason field is required when status is cancelled."],
    });
  }

  if (dto.status === "confirmed") {
    const appointment = await appointments.confirm(req.params.id);
    res.json({ data: appointmentResource(appointment) });
    return;
  }

  const appointment = await appointments.transition(req.params.id, dto.status, dto.cancellation_reason);
  res.json({ data: appointmentResource(appointment) });
});
