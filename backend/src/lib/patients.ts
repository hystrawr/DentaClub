import { prisma } from "./prisma.js";
import { HttpError, notFound } from "./http-error.js";

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