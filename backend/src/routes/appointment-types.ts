import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/auth.js";
import { notFound } from "../lib/http-error.js";
import { appointmentTypeModel } from "../services/scheduling/mapper.js";

// Ported from DentalOS apps/api/src/scheduling/appointment-type.controller.ts.
// Mounted at /api/appointment-types.
export const appointmentTypesRouter = Router();

const createType = z.object({
  name: z.string().trim().min(1, "The name field is required.").max(255),
  duration_minutes: z.number().int().min(5, "The duration minutes field must be at least 5.").nullish(),
  color_hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullish(),
  is_block_time: z.boolean().nullish(),
  recall_interval_months: z.number().int().min(1).nullish(),
  /** Pesos; the column is DECIMAL(10,2). Null clears it. */
  price: z.number().min(0, "The price must be at least 0.").max(99_999_999.99).nullish(),
  is_active: z.boolean().nullish(),
});

const updateType = createType.partial();

appointmentTypesRouter.get("/", async (_req, res) => {
  const rows = await prisma.appointmentType.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
  res.json(rows.map(appointmentTypeModel));
});

appointmentTypesRouter.post("/", requireAdmin, async (req, res) => {
  const dto = createType.parse(req.body);
  const created = await prisma.appointmentType.create({
    data: {
      name: dto.name,
      // Each of these has a database default, so an omitted field falls through to it.
      ...(dto.duration_minutes != null ? { durationMinutes: dto.duration_minutes } : {}),
      ...(dto.color_hex != null ? { colorHex: dto.color_hex } : {}),
      ...(dto.is_block_time != null ? { isBlockTime: dto.is_block_time } : {}),
      recallIntervalMonths: dto.recall_interval_months ?? null,
      price: dto.price ?? null,
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
  });
  res.status(201).json(appointmentTypeModel(created));
});

appointmentTypesRouter.patch("/:id", requireAdmin, async (req, res) => {
  const dto = updateType.parse(req.body);
  const found = await prisma.appointmentType.findUnique({ where: { id: req.params.id } });
  if (!found) throw notFound(`No appointment type ${req.params.id}`);

  const updated = await prisma.appointmentType.update({
    where: { id: req.params.id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.duration_minutes != null ? { durationMinutes: dto.duration_minutes } : {}),
      ...(dto.color_hex != null ? { colorHex: dto.color_hex } : {}),
      ...(dto.is_block_time != null ? { isBlockTime: dto.is_block_time } : {}),
      ...(dto.recall_interval_months !== undefined ? { recallIntervalMonths: dto.recall_interval_months } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.is_active != null ? { isActive: dto.is_active } : {}),
    },
  });
  res.json(appointmentTypeModel(updated));
});
