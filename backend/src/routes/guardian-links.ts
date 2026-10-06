import { Router } from "express";
import { z } from "zod";
import type { GuardianLink, Patient } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { invalidField, notFound, ruleViolation } from "../lib/http-error.js";
import { dateString, isoUtc } from "../lib/dates.js";

/**
 * Guardian links — who may consent on a minor's behalf. (Ported from DentalOS.)
 *
 * `consent_authority_flag` is the one that matters clinically: it is what the
 * consent signing flow checks before accepting a signature for a patient who
 * cannot legally give one. Mounted at /api/guardian-links.
 */
export const guardianLinksRouter = Router();

const GUARDIAN_RELATIONSHIPS = ["parent", "legal_guardian", "grandparent", "sibling", "other"] as const;

const createLink = z.object({
  guardian_patient_id: z.string().min(1),
  ward_patient_id: z.string().min(1),
  relationship: z.enum(GUARDIAN_RELATIONSHIPS, "The selected relationship is invalid."),
  consent_authority_flag: z.boolean().optional(),
});

const updateLink = z.object({
  relationship: z.enum(GUARDIAN_RELATIONSHIPS).optional(),
  consent_authority_flag: z.boolean().optional(),
});

const patientSummary = (p: Patient) => ({
  id: p.id,
  first_name: p.firstName,
  last_name: p.lastName,
  date_of_birth: dateString(p.dateOfBirth),
});

function guardianLinkResource(link: GuardianLink & { guardian?: Patient | null; ward?: Patient | null }) {
  return {
    id: link.id,
    guardian_patient_id: link.guardianPatientId,
    ward_patient_id: link.wardPatientId,
    relationship: link.relationship,
    consent_authority_flag: link.consentAuthorityFlag,
    ...(link.guardian ? { guardian: patientSummary(link.guardian) } : {}),
    ...(link.ward ? { ward: patientSummary(link.ward) } : {}),
    created_at: isoUtc(link.createdAt),
  };
}

/**
 * GET /api/guardian-links?patient_id=… — a patient's guardians and wards.
 * (Not in DentalOS, which nests these in the patient record; the mini UI needs a list.)
 */
guardianLinksRouter.get("/", async (req, res) => {
  const patientId = typeof req.query.patient_id === "string" ? req.query.patient_id : undefined;
  const rows = await prisma.guardianLink.findMany({
    where: patientId ? { OR: [{ wardPatientId: patientId }, { guardianPatientId: patientId }] } : {},
    include: { guardian: true, ward: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ data: rows.map(guardianLinkResource) });
});

/** POST /api/guardian-links — link a guardian to a ward. */
guardianLinksRouter.post("/", async (req, res) => {
  const dto = createLink.parse(req.body);

  for (const field of ["guardian_patient_id", "ward_patient_id"] as const) {
    const exists = await prisma.patient.findUnique({ where: { id: dto[field] }, select: { id: true } });
    if (!exists) throw invalidField(field);
  }
  if (dto.guardian_patient_id === dto.ward_patient_id) {
    throw ruleViolation("Validation failed.", {
      ward_patient_id: ["The ward patient id and guardian patient id must be different."],
    });
  }

  const link = await prisma.guardianLink.create({
    data: {
      guardianPatientId: dto.guardian_patient_id,
      wardPatientId: dto.ward_patient_id,
      relationship: dto.relationship,
      consentAuthorityFlag: dto.consent_authority_flag ?? false,
    },
    include: { guardian: true, ward: true },
  });

  res.status(201).json({ data: guardianLinkResource(link) });
});

/** PATCH /api/guardian-links/:id — change the relationship or consent authority. */
guardianLinksRouter.patch("/:id", async (req, res) => {
  const dto = updateLink.parse(req.body);
  const link = await prisma.guardianLink.findUnique({ where: { id: req.params.id } });
  if (!link) throw notFound(`No guardian link ${req.params.id}`);

  const updated = await prisma.guardianLink.update({
    where: { id: req.params.id },
    data: {
      ...(dto.relationship !== undefined ? { relationship: dto.relationship } : {}),
      ...(dto.consent_authority_flag !== undefined ? { consentAuthorityFlag: dto.consent_authority_flag } : {}),
    },
  });

  res.json({ data: guardianLinkResource(updated) });
});

/** DELETE /api/guardian-links/:id */
guardianLinksRouter.delete("/:id", async (req, res) => {
  await prisma.guardianLink.delete({ where: { id: req.params.id } });
  res.json({ message: "Guardian link removed." });
});
