import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { manilaDayEnd, manilaDayStart, manilaToday } from "../lib/dates.js";
import { boardItem } from "../services/scheduling/mapper.js";

/**
 * The chairside board — the clinic's live queue. Mounted at /api/chairside.
 * Status changes go through PATCH /api/appointments/:id/status.
 */
export const chairsideRouter = Router();

/**
 * GET /api/chairside/board — today's appointments, keyed by chair name.
 *
 * A Manila day, not a UTC one: read as UTC the window would open at 08:00 local
 * and put the morning's first patients on yesterday's board. An appointment
 * with no chair still appears under "Unassigned" — an unassigned patient is
 * exactly the one the front desk needs to see.
 */
chairsideRouter.get("/board", async (_req, res) => {
  const today = manilaToday();
  const rows = await prisma.appointment.findMany({
    where: { scheduledStart: { gte: manilaDayStart(today), lt: manilaDayEnd(today) } },
    include: { patient: true, appointmentType: true, operatory: true },
    orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
  });

  const grouped: Record<string, ReturnType<typeof boardItem>[]> = {};
  for (const row of rows) {
    const chair = row.operatory?.name ?? "Unassigned";
    (grouped[chair] ??= []).push(boardItem(row));
  }
  res.json(grouped);
});
