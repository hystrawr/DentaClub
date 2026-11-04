import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { HttpError, notFound } from "../lib/http-error.js";
import { isoOffset } from "../lib/dates.js";
import { historyData, type HistoryInput } from "./medical-history.js";

// The patient directory's rules: no two active patients with the same name, no
// changes to a removed patient, and no removing one who still has a visit
// coming up. Removing only hides a patient; their chart, consents and
// appointments are kept.

/** "Juan Santos Dela Cruz Jr." — the middle name and suffix when present. */
export const fullName = (p: { firstName: string; middleName: string | null; lastName: string; suffix: string | null }): string =>
  `${p.firstName} ${p.middleName ?? ""} ${p.lastName} ${p.suffix ?? ""}`.replace(/\s+/g, " ").trim();

/**
 * Refuse changes to a removed patient's record. Their records stay readable;
 * an admin restores them before anything new is written.
 */
export async function assertActivePatient(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id }, select: { isActive: true } });
  if (!patient) throw notFound("Patient not found");
  if (!patient.isActive) {
    throw new HttpError(409, "This patient is inactive. Restore them before making changes.");
  }
}

/* ── Duplicate names ────────────────────────────────────────────────────── */

type Name = { firstName: string; middleName: string | null; lastName: string };

const sameText = (value: string) => ({ equals: value, mode: "insensitive" as const });

/**
 * The patient already filed under this first, middle and last name, whatever
 * the capitals, or null. No middle name only matches no middle name.
 * `exceptId` is the patient being renamed, who may keep their own name.
 */
export function findNameClash(name: Name, exceptId?: string, db: Prisma.TransactionClient = prisma) {
  return db.patient.findFirst({
    where: {
      isActive: true,
      firstName: sameText(name.firstName),
      lastName: sameText(name.lastName),
      ...(name.middleName ? { middleName: sameText(name.middleName) } : { OR: [{ middleName: null }, { middleName: "" }] }),
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true, firstName: true, middleName: true, lastName: true, suffix: true },
  });
}

/** Refuse a second patient with the same name (see findNameClash). */
async function assertNameFree(db: Prisma.TransactionClient, name: Name, exceptId?: string) {
  const clash = await findNameClash(name, exceptId, db);
  if (clash) {
    throw new HttpError(409, `A patient named ${fullName(clash)} already exists.`, undefined, { existing_patient_id: clash.id });
  }
}

/* ── The directory ──────────────────────────────────────────────────────── */

/**
 * Every patient, A–Z by last name then first name, each with their last
 * completed visit and next booked appointment (and who it is with).
 * Search matches first name, last name or mobile number. `inactive` lists
 * removed patients instead, so they can be found and restored.
 */
export async function list(search: string, inactive: boolean) {
  const patients = await prisma.patient.findMany({
    where: {
      isActive: !inactive,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { mobile: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
  });

  const ids = patients.map((p) => p.id);
  const withProvider = { provider: { select: { id: true, name: true } } } as const;

  // One row per patient: their latest completed visit and their soonest booked appointment.
  const [lastVisits, nextAppointments] = await Promise.all([
    prisma.appointment.findMany({
      where: { patientId: { in: ids }, status: "completed" },
      orderBy: [{ patientId: "asc" }, { scheduledStart: "desc" }],
      distinct: ["patientId"],
      include: withProvider,
    }),
    prisma.appointment.findMany({
      where: { patientId: { in: ids }, status: { in: ["scheduled", "confirmed"] }, scheduledStart: { gte: new Date() } },
      orderBy: [{ patientId: "asc" }, { scheduledStart: "asc" }],
      distinct: ["patientId"],
      include: withProvider,
    }),
  ]);

  const lastByPatient = new Map(lastVisits.map((a) => [a.patientId, a]));
  const nextByPatient = new Map(nextAppointments.map((a) => [a.patientId, a]));

  return patients.map((patient) => ({
    patient,
    lastVisit: lastByPatient.get(patient.id),
    nextAppointment: nextByPatient.get(patient.id),
  }));
}

export async function findOrFail(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id } });
  if (!patient) throw notFound("Patient not found");
  return patient;
}

/* ── Changes ────────────────────────────────────────────────────────────── */

/**
 * Registration: the patient, and optionally their medical history, saved
 * together. History is left out when nothing in it was answered, so a blank
 * checklist is never stored as "No" to every condition.
 */
export function register(data: Prisma.PatientCreateInput, history?: HistoryInput) {
  return prisma.$transaction(async (tx) => {
    await assertNameFree(tx, { firstName: data.firstName, middleName: data.middleName ?? null, lastName: data.lastName });
    const created = await tx.patient.create({ data });
    if (history) {
      await tx.medicalHistory.create({ data: { patientId: created.id, ...historyData(history) } });
    }
    return created;
  });
}

/** The name columns as plain values, so a rename can be checked for clashes. */
type NameChange = { firstName?: string; middleName?: string | null; lastName?: string };

/** Partial update: only the columns in `data` change. The caller checks the patient is active first. */
export function update(id: string, data: Prisma.PatientUpdateInput & NameChange) {
  return prisma.$transaction(async (tx) => {
    if (data.firstName !== undefined || data.middleName !== undefined || data.lastName !== undefined) {
      const current = await tx.patient.findUnique({ where: { id } });
      if (!current) throw notFound("Patient not found");
      await assertNameFree(
        tx,
        {
          firstName: data.firstName ?? current.firstName,
          middleName: data.middleName !== undefined ? data.middleName : current.middleName,
          lastName: data.lastName ?? current.lastName,
        },
        id,
      );
    }
    return tx.patient.update({ where: { id }, data });
  });
}

/**
 * Take the patient out of the directory. Refused while they still have an
 * upcoming appointment, so the front desk cancels it first.
 */
export async function remove(id: string) {
  const upcoming = await prisma.appointment.findMany({
    where: {
      patientId: id,
      status: { in: ["scheduled", "confirmed", "arrived", "in_chair"] },
      scheduledEnd: { gte: new Date() },
    },
    orderBy: { scheduledStart: "asc" },
    select: { id: true, scheduledStart: true },
  });
  const [next] = upcoming;
  if (next) {
    // "Nov 5, 10:00 AM" on the clinic's clock.
    const when = next.scheduledStart.toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    const message =
      upcoming.length === 1
        ? `This patient has an appointment on ${when}. Cancel it first.`
        : `This patient has ${upcoming.length} upcoming appointments, the next on ${when}. Cancel them first.`;
    throw new HttpError(409, message, undefined, {
      upcoming_appointments: upcoming.length,
      next_appointment: { appointment_id: next.id, start: isoOffset(next.scheduledStart) },
    });
  }
  await prisma.patient.update({ where: { id }, data: { isActive: false } });
}

/** Put a removed patient back in the directory. */
export function restore(id: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.patient.findUnique({ where: { id } });
    if (!current) throw notFound("Patient not found");
    // Someone may have registered a patient with the same name since; don't make two.
    await assertNameFree(tx, current, id);
    return tx.patient.update({ where: { id }, data: { isActive: true } });
  });
}
