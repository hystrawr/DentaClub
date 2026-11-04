import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/auth.js";
import { invalidField, notFound, ruleViolation } from "../lib/http-error.js";
import { isDateString } from "../lib/dates.js";
import { getAvailableSlots } from "../services/scheduling/availability.js";
import { providerAvailabilityModel, providerProfileResource, withSpecializations } from "../services/scheduling/mapper.js";

// Dentists and their weekly availability. Ported from DentalOS
// apps/api/src/scheduling/provider.controller.ts. Mounted at /api.
export const providersRouter = Router();

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "The color hex field must be like #3B82F6.");

// One row each in provider_specializations, so blanks go and repeats collapse.
const specializations = z
  .array(z.string().trim().max(255))
  .transform((names) => [...new Set(names.filter((name) => name !== ""))])
  .nullish();

/** The specialization rows for a create; null or absent is none. */
const specializationRows = (names: string[] | null | undefined) => ({
  create: (names ?? []).map((name) => ({ name })),
});

const createProvider = z.object({
  // DentalOS takes a `user_id` and reads the name from the staff account.
  name: z.string().trim().min(1, "The name field is required.").max(255),
  prc_number: z.string().nullish(),
  specializations,
  color_hex: hexColor.nullish(),
  is_active: z.boolean().nullish(),
});

const updateProvider = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  prc_number: z.string().nullish(),
  specializations,
  color_hex: hexColor.nullish(),
  is_active: z.boolean().nullish(),
});

const hhmm = (field: string) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `The ${field} field must match the format H:i.`);

const setAvailability = z.object({
  availabilities: z.array(
    z.object({
      location_id: z.string().min(1, "The location id field is required."),
      day_of_week: z.coerce.number().int().min(0, "The day of week field must be between 0 and 6.").max(6, "The day of week field must be between 0 and 6."),
      start_time: hhmm("start time"),
      end_time: hhmm("end time"),
    }),
  ),
});

const asTime = (hhmmValue: string): Date => new Date(`1970-01-01T${hhmmValue}:00.000Z`);

function requireDate(date: unknown): asserts date is string {
  if (!isDateString(date)) {
    throw ruleViolation("Validation failed.", {
      date: [date ? "The date field must be a valid date." : "The date field is required."],
    });
  }
}

function readSlotMinutes(raw: unknown): number {
  if (raw === undefined || raw === "") return 15;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 5) {
    throw ruleViolation("Validation failed.", { slot_minutes: ["The slot minutes field must be at least 5."] });
  }
  return value;
}

async function findOrFail(id: string) {
  const profile = await prisma.providerProfile.findUnique({ where: { id }, include: withSpecializations });
  if (!profile) throw notFound(`No provider ${id}`);
  return profile;
}

providersRouter.get("/providers", async (_req, res) => {
  const rows = await prisma.providerProfile.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: withSpecializations,
  });
  res.json({ data: rows.map(providerProfileResource) });
});

providersRouter.post("/providers", requireAdmin, async (req, res) => {
  const dto = createProvider.parse(req.body);
  const created = await prisma.providerProfile.create({
    data: {
      name: dto.name,
      prcNumber: dto.prc_number ?? null,
      specializations: specializationRows(dto.specializations),
      ...(dto.color_hex ? { colorHex: dto.color_hex } : {}),
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
    include: withSpecializations,
  });
  res.status(201).json(providerProfileResource(created));
});

providersRouter.get("/providers/:id", async (req, res) => {
  res.json(providerProfileResource(await findOrFail(req.params.id)));
});

providersRouter.patch("/providers/:id", requireAdmin, async (req, res) => {
  const dto = updateProvider.parse(req.body);
  await findOrFail(req.params.id);
  const updated = await prisma.providerProfile.update({
    where: { id: req.params.id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.prc_number !== undefined ? { prcNumber: dto.prc_number } : {}),
      // A list replaces the old one; null clears it.
      ...(dto.specializations !== undefined
        ? { specializations: { deleteMany: {}, ...specializationRows(dto.specializations) } }
        : {}),
      ...(dto.color_hex != null ? { colorHex: dto.color_hex } : {}),
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
    include: withSpecializations,
  });
  res.json(providerProfileResource(updated));
});

/** GET /api/providers/:id/availability — the weekly rules. */
providersRouter.get("/providers/:id/availability", async (req, res) => {
  await findOrFail(req.params.id);
  const rules = await prisma.providerAvailability.findMany({
    where: { providerProfileId: req.params.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }, { id: "asc" }],
  });
  res.json(rules.map(providerAvailabilityModel));
});

/**
 * PUT /api/providers/:id/availability — replace the whole weekly schedule.
 *
 * **Destructive by design**: every existing rule is deleted and the payload
 * written in its place, so callers must send the whole week. The delete and the
 * re-create run in **one transaction** — a failure halfway must not leave the
 * dentist with no availability at all.
 */
providersRouter.put("/providers/:id/availability", requireAdmin, async (req, res) => {
  const dto = setAvailability.parse(req.body);
  const id = req.params.id;
  await findOrFail(id);

  const starts = new Set<string>();
  for (const [index, rule] of dto.availabilities.entries()) {
    if (rule.end_time <= rule.start_time) {
      throw ruleViolation("Validation failed.", {
        [`availabilities.${index}.end_time`]: ["The end time field must be a date after start time."],
      });
    }
    const key = `${rule.day_of_week}|${rule.start_time}`;
    if (starts.has(key)) {
      throw ruleViolation("Validation failed.", {
        [`availabilities.${index}.start_time`]: ["Another window already starts at this time on this day."],
      });
    }
    starts.add(key);
  }

  for (const locationId of new Set(dto.availabilities.map((r) => r.location_id))) {
    const exists = await prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!exists) throw invalidField("location_id");
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.providerAvailability.deleteMany({ where: { providerProfileId: id } });
    const rows = [];
    for (const rule of dto.availabilities) {
      rows.push(
        await tx.providerAvailability.create({
          data: {
            providerProfileId: id,
            locationId: rule.location_id,
            dayOfWeek: rule.day_of_week,
            startTime: asTime(rule.start_time),
            endTime: asTime(rule.end_time),
          },
        }),
      );
    }
    return rows;
  });

  res.json(created.map(providerAvailabilityModel));
});

/** GET /api/providers/:id/slots?date=2026-10-05&slot_minutes=15 — free slots on a date. */
providersRouter.get("/providers/:id/slots", async (req, res) => {
  requireDate(req.query.date);
  await findOrFail(req.params.id);
  res.json({ data: await getAvailableSlots(req.params.id, req.query.date, readSlotMinutes(req.query.slot_minutes)) });
});
