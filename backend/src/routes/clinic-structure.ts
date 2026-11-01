import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/auth.js";
import { invalidField, notFound } from "../lib/http-error.js";
import { locationResource, operatoryResource } from "../services/scheduling/mapper.js";

/**
 * Locations (branches) and operatories (chairs). Ported from DentalOS
 * apps/api/src/scheduling/clinic-structure.controller.ts. Mounted at /api.
 *
 * `is_active` is the retirement mechanism. There is no DELETE on either: a
 * location or a chair is named by appointments going back years, and removing
 * the row would orphan them.
 */
export const clinicStructureRouter = Router();

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "The color field must be like #10B981.");

const createLocation = z.object({
  name: z.string().trim().min(1, "The name field is required.").max(255),
  address: z.string().max(500).nullish(),
  city: z.string().max(255).nullish(),
  phone: z.string().max(50).nullish(),
  is_active: z.boolean().nullish(),
});

const updateLocation = createLocation.partial();

const createOperatory = z.object({
  location_id: z.string().min(1, "The location id field is required."),
  name: z.string().trim().min(1, "The name field is required.").max(255),
  color: hexColor.nullish(),
  sort_order: z.number().int().min(0).nullish(),
  is_active: z.boolean().nullish(),
});

const updateOperatory = createOperatory.omit({ location_id: true }).partial();

/** `?active=1`, `?active=true`. Anything else, including absent, means "all". */
const isTruthy = (raw: unknown) => raw === "1" || raw === "true";

/* ── Locations ─────────────────────────────────────────────────────────── */

/**
 * Every location by default, active ones with `?active=1`. A settings screen
 * that hides what it manages cannot be used to un-hide it; callers offering a
 * choice (a booking form) pass `active=1`.
 */
clinicStructureRouter.get("/locations", async (req, res) => {
  const rows = await prisma.location.findMany({
    where: isTruthy(req.query.active) ? { isActive: true } : {},
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  res.json({ data: rows.map(locationResource) });
});

clinicStructureRouter.post("/locations", requireAdmin, async (req, res) => {
  const dto = createLocation.parse(req.body);
  const created = await prisma.location.create({
    data: {
      name: dto.name,
      address: dto.address ?? null,
      city: dto.city ?? null,
      phone: dto.phone ?? null,
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
  });
  res.status(201).json({ data: locationResource(created) });
});

clinicStructureRouter.patch("/locations/:id", requireAdmin, async (req, res) => {
  const dto = updateLocation.parse(req.body);
  const found = await prisma.location.findUnique({ where: { id: req.params.id } });
  if (!found) throw notFound(`No location ${req.params.id}`);

  const updated = await prisma.location.update({
    where: { id: req.params.id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.address !== undefined ? { address: dto.address } : {}),
      ...(dto.city !== undefined ? { city: dto.city } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
  });
  res.json({ data: locationResource(updated) });
});

/* ── Operatories ───────────────────────────────────────────────────────── */

/** Ordered the way the chairside board draws them — `sort_order`, then name. */
clinicStructureRouter.get("/operatories", async (req, res) => {
  const locationId = typeof req.query.location_id === "string" ? req.query.location_id : undefined;
  const rows = await prisma.operatory.findMany({
    where: {
      ...(locationId ? { locationId } : {}),
      ...(isTruthy(req.query.active) ? { isActive: true } : {}),
    },
    include: { location: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
  });
  res.json({ data: rows.map(operatoryResource) });
});

clinicStructureRouter.post("/operatories", requireAdmin, async (req, res) => {
  const dto = createOperatory.parse(req.body);

  // Checked here rather than left to the foreign key, which would be a 500.
  const location = await prisma.location.findUnique({ where: { id: dto.location_id } });
  if (!location) throw invalidField("location_id");

  const created = await prisma.operatory.create({
    data: {
      locationId: dto.location_id,
      name: dto.name,
      color: dto.color ?? null,
      ...(dto.sort_order != null ? { sortOrder: dto.sort_order } : {}),
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
    include: { location: true },
  });
  res.status(201).json({ data: operatoryResource(created) });
});

clinicStructureRouter.patch("/operatories/:id", requireAdmin, async (req, res) => {
  const dto = updateOperatory.parse(req.body);
  const found = await prisma.operatory.findUnique({ where: { id: req.params.id } });
  if (!found) throw notFound(`No operatory ${req.params.id}`);

  const updated = await prisma.operatory.update({
    where: { id: req.params.id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.color !== undefined ? { color: dto.color } : {}),
      ...(dto.sort_order != null ? { sortOrder: dto.sort_order } : {}),
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
    include: { location: true },
  });
  res.json({ data: operatoryResource(updated) });
});
