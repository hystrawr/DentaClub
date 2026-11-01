import type { Appointment, AppointmentStatus, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError, invalidField, notFound, ruleViolation } from "../../lib/http-error.js";
import { isDateString, manilaDayEnd, manilaDayStart } from "../../lib/dates.js";
import { appointmentResource } from "./mapper.js";

// Ported from DentalOS apps/api/src/scheduling/appointment.service.ts.
// Recurring series are not ported (not selected).

/**
 * The status machine, exactly as DentalOS defines it. Every terminal state has
 * an empty list, so a completed appointment cannot be reopened and a cancelled
 * one cannot be resurrected.
 */
const ALLOWED: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  scheduled: ["confirmed", "cancelled", "no_show"],
  confirmed: ["arrived", "cancelled", "no_show"],
  arrived: ["in_chair", "cancelled"],
  in_chair: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Statuses that free up the slot, so they never count as a double-booking. */
export const RELEASES_SLOT: AppointmentStatus[] = ["cancelled", "no_show"];

/** Every appointment response carries the same four relations. */
const WITH_RELATIONS = {
  patient: true,
  provider: true,
  appointmentType: true,
  operatory: true,
} as const;

type Db = Prisma.TransactionClient;

export interface AppointmentFilters {
  date?: string;
  date_from?: string;
  date_to?: string;
  provider_id?: string;
  status?: string;
  operatory_id?: string;
  patient_id?: string;
}

/**
 * The calendar's list.
 *
 * Bounds are Manila days: `date_to=2026-08-29` includes everything up to that
 * evening, not up to its midnight.
 */
export async function list(filters: AppointmentFilters) {
  for (const key of ["date", "date_from", "date_to"] as const) {
    const value = filters[key];
    if (value !== undefined && !isDateString(value)) {
      throw ruleViolation("Validation failed.", { [key]: [`The ${key.replace("_", " ")} field must be a valid date.`] });
    }
  }

  const where: Prisma.AppointmentWhereInput = {};

  if (filters.date) {
    where.scheduledStart = { gte: manilaDayStart(filters.date), lt: manilaDayEnd(filters.date) };
  } else if (filters.date_from || filters.date_to) {
    where.scheduledStart = {
      ...(filters.date_from ? { gte: manilaDayStart(filters.date_from) } : {}),
      ...(filters.date_to ? { lt: manilaDayEnd(filters.date_to) } : {}),
    };
  }

  if (filters.provider_id) where.providerProfileId = filters.provider_id;
  if (filters.status) {
    if (!(filters.status in ALLOWED)) throw invalidField("status");
    where.status = filters.status as AppointmentStatus;
  }
  if (filters.operatory_id) where.operatoryId = filters.operatory_id;
  if (filters.patient_id) where.patientId = filters.patient_id;

  return prisma.appointment.findMany({
    where,
    include: WITH_RELATIONS,
    // Chronological, `id` breaking ties — stable across reads.
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
  });
}

export async function findOrFail(id: string, db: Db = prisma) {
  const appointment = await db.appointment.findUnique({ where: { id }, include: WITH_RELATIONS });
  if (!appointment) throw notFound(`No appointment ${id}`);
  return appointment;
}

export interface BookInput {
  provider_profile_id: string;
  scheduled_start: string;
  scheduled_end: string;
  patient_id?: string | null;
  appointment_type_id?: string | null;
  operatory_id?: string | null;
  notes?: string | null;
}

/**
 * Book an appointment. Conflicts are **not** checked here — `confirm()` does,
 * exactly as in DentalOS: a tentative booking may overlap, a confirmed one may not.
 *
 * Added here: every referenced id is checked first so a typo is a 422 naming the
 * field rather than a database error, and the branch is taken from the chair.
 */
export async function book(dto: BookInput) {
  const start = new Date(dto.scheduled_start);
  const end = new Date(dto.scheduled_end);
  assertRange(start, end);

  const provider = await prisma.providerProfile.findUnique({ where: { id: dto.provider_profile_id } });
  if (!provider) throw invalidField("provider_profile_id");

  if (dto.patient_id && !(await prisma.patient.findUnique({ where: { id: dto.patient_id }, select: { id: true } }))) {
    throw invalidField("patient_id");
  }

  let type = null;
  if (dto.appointment_type_id) {
    type = await prisma.appointmentType.findUnique({ where: { id: dto.appointment_type_id } });
    if (!type) throw invalidField("appointment_type_id");
  }

  // Only block time (lunch, meetings) may have no patient.
  if (!dto.patient_id && !type?.isBlockTime) {
    throw ruleViolation("Validation failed.", {
      patient_id: ["The patient id field is required unless the appointment type is block time."],
    });
  }

  let locationId: string | null = null;
  if (dto.operatory_id) {
    const operatory = await prisma.operatory.findUnique({ where: { id: dto.operatory_id } });
    if (!operatory) throw invalidField("operatory_id");
    locationId = operatory.locationId;
  }

  const appointment = await prisma.appointment.create({
    data: {
      patientId: dto.patient_id ?? null,
      providerProfileId: dto.provider_profile_id,
      appointmentTypeId: dto.appointment_type_id ?? null,
      operatoryId: dto.operatory_id ?? null,
      locationId,
      status: "scheduled",
      scheduledStart: start,
      scheduledEnd: end,
      notes: dto.notes ?? null,
    },
  });

  return findOrFail(appointment.id);
}

export interface UpdateInput {
  scheduled_start?: string;
  scheduled_end?: string;
  notes?: string | null;
  operatory_id?: string | null;
}

/**
 * Reschedule or annotate.
 *
 * Added here: DentalOS lets a *confirmed* appointment be moved onto a time that
 * is already taken, because conflicts are only checked at confirmation. Moving a
 * live (non-scheduled) appointment re-runs the same double-booking check.
 */
export async function update(id: string, dto: UpdateInput) {
  return prisma.$transaction(async (tx) => {
    const current = await rowOrFail(id, tx);

    const start = dto.scheduled_start !== undefined ? new Date(dto.scheduled_start) : current.scheduledStart;
    const end = dto.scheduled_end !== undefined ? new Date(dto.scheduled_end) : current.scheduledEnd;
    assertRange(start, end);

    let locationId = current.locationId;
    if (dto.operatory_id) {
      const operatory = await tx.operatory.findUnique({ where: { id: dto.operatory_id } });
      if (!operatory) throw invalidField("operatory_id");
      locationId = operatory.locationId;
    }

    const next = {
      ...current,
      scheduledStart: start,
      scheduledEnd: end,
      operatoryId: dto.operatory_id !== undefined ? dto.operatory_id : current.operatoryId,
    };

    const moved =
      start.getTime() !== current.scheduledStart.getTime() ||
      end.getTime() !== current.scheduledEnd.getTime() ||
      next.operatoryId !== current.operatoryId;

    // Only a visit still to come can move: once the patient is here, or it is over, the times are a record.
    if (moved && current.status !== "scheduled" && current.status !== "confirmed") {
      throw ruleViolation(`A ${current.status.replace("_", " ")} appointment cannot be rescheduled.`);
    }

    if (moved && current.status !== "scheduled" && !RELEASES_SLOT.includes(current.status)) {
      await assertNoConflicts(tx, next);
    }

    await tx.appointment.update({
      where: { id },
      data: {
        scheduledStart: start,
        scheduledEnd: end,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.operatory_id !== undefined ? { operatoryId: dto.operatory_id, locationId } : {}),
      },
    });

    return findOrFail(id, tx);
  });
}

/**
 * Double-booking check. Overlap is half-open on both ends —
 * `start < other.end && end > other.start` — so back-to-back appointments do
 * not collide.
 */
async function conflictFor(db: Db, appointment: Appointment, scope: "provider" | "operatory") {
  if (scope === "operatory" && !appointment.operatoryId) return null;

  return db.appointment.findFirst({
    where: {
      ...(scope === "provider"
        ? { providerProfileId: appointment.providerProfileId }
        : { operatoryId: appointment.operatoryId }),
      id: { not: appointment.id },
      status: { notIn: RELEASES_SLOT },
      scheduledStart: { lt: appointment.scheduledEnd },
      scheduledEnd: { gt: appointment.scheduledStart },
    },
    // Ordered, so the 409 names the *same* conflict every time.
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
  });
}

/**
 * A 409 carrying the appointment in the way, so the front desk sees what is
 * blocking rather than being told "no".
 *
 * Added here: the check and the write run under a per-dentist and per-chair
 * advisory lock. Without it, two front-desk clicks confirming overlapping
 * appointments at the same moment would both pass the check (DentalOS has this
 * race).
 */
async function assertNoConflicts(tx: Db, appointment: Appointment) {
  const keys = [`provider:${appointment.providerProfileId}`];
  if (appointment.operatoryId) keys.push(`operatory:${appointment.operatoryId}`);
  // Always the same order, so two transactions can never wait on each other.
  for (const key of keys.sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  const provider = await conflictFor(tx, appointment, "provider");
  if (provider) throw schedulingConflict(provider, "Provider has a conflicting appointment.");

  const operatory = await conflictFor(tx, appointment, "operatory");
  if (operatory) throw schedulingConflict(operatory, "Operatory has a conflicting appointment.");
}

const schedulingConflict = (conflicting: Appointment, message: string) =>
  new HttpError(409, message, undefined, {
    conflicting_appointment: appointmentResource(conflicting, false),
  });

/** scheduled → confirmed, refused if the dentist or chair is already taken. */
export async function confirm(id: string) {
  return prisma.$transaction(async (tx) => {
    const appointment = await rowOrFail(id, tx);
    if (appointment.status !== "scheduled") {
      throw ruleViolation(`Cannot confirm appointment with status [${appointment.status}]. Must be [scheduled].`);
    }

    await assertNoConflicts(tx, appointment);
    await setStatus(tx, appointment, "confirmed", {});
    return findOrFail(id, tx);
  });
}

/**
 * Move an appointment through the status machine. `confirmed` is routed to
 * `confirm()` by the caller, so the double-booking check always runs.
 */
export async function transition(id: string, newStatus: AppointmentStatus, cancellationReason?: string | null) {
  const appointment = await rowOrFail(id);
  const allowed = ALLOWED[appointment.status] ?? [];

  if (!allowed.includes(newStatus)) {
    throw ruleViolation(`Cannot transition appointment from [${appointment.status}] to [${newStatus}].`);
  }

  if (newStatus === "cancelled" && !cancellationReason) {
    throw ruleViolation("A cancellation reason is required when cancelling an appointment.");
  }

  const now = new Date();

  await setStatus(prisma, appointment, newStatus, {
    ...(newStatus === "cancelled" ? { cancellationReason } : {}),
    ...(newStatus === "in_chair" ? { actualStart: now } : {}),
    ...(newStatus === "completed" ? { actualEnd: now } : {}),
  });

  return findOrFail(id);
}

export function cancel(id: string, reason: string) {
  return transition(id, "cancelled", reason);
}

/**
 * Write the new status only if nobody changed it since we read it. Two people
 * clicking "Arrived" and "Cancel" at once would otherwise both succeed, the
 * second silently overwriting the first.
 */
async function setStatus(
  db: Db,
  appointment: Appointment,
  status: AppointmentStatus,
  data: Prisma.AppointmentUpdateManyMutationInput,
) {
  const result = await db.appointment.updateMany({
    where: { id: appointment.id, status: appointment.status },
    data: { ...data, status },
  });
  if (result.count === 0) {
    throw new HttpError(409, "This appointment was changed by someone else. Reload and try again.");
  }
}

async function rowOrFail(id: string, db: Db = prisma) {
  const appointment = await db.appointment.findUnique({ where: { id } });
  if (!appointment) throw notFound(`No appointment ${id}`);
  return appointment;
}

function assertRange(start: Date, end: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ruleViolation("Validation failed.", { scheduled_start: ["The scheduled start field must be a valid date."] });
  }
  if (end.getTime() <= start.getTime()) {
    throw ruleViolation("Validation failed.", {
      scheduled_end: ["The scheduled end field must be a date after scheduled start."],
    });
  }
}
