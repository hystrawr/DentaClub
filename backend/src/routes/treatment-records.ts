import { Router } from "express";
import { z } from "zod";
import type { TreatmentRecord } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";
import { dateString } from "../lib/dates.js";
import { assertActivePatient } from "../services/patients.js";

// The Treatment Record sheet: one row per procedure, typed in like a
// spreadsheet. Mounted at /api.
export const treatmentRecordsRouter = Router();

/** Money on the wire is a number of pesos; the column is DECIMAL(10,2). */
const money = z.number().min(0).max(99_999_999.99).nullable();
const text = (max: number) => z.string().trim().max(max).transform((s) => (s === "" ? null : s)).nullable();

const row = z.object({
  visit_date: z.iso.date("The date must be a valid date.").nullable(),
  teeth: text(50),
  procedure: text(255),
  doctor: text(150),
  amount_charged: money,
  amount_paid: money,
  next_appointment: z.iso.date("The next appointment must be a valid date.").nullable(),
});

/** The whole sheet, in order. Blank rows are dropped rather than stored. */
const saveSheet = z.object({ rows: z.array(row).max(500) });

type Row = z.infer<typeof row>;

const isBlank = (r: Row) => Object.values(r).every((v) => v === null);

function resource(r: TreatmentRecord) {
  return {
    id: r.id,
    visit_date: dateString(r.visitDate),
    teeth: r.teeth,
    procedure: r.procedure,
    doctor: r.doctor,
    amount_charged: r.amountCharged === null ? null : Number(r.amountCharged),
    amount_paid: r.amountPaid === null ? null : Number(r.amountPaid),
    next_appointment: dateString(r.nextAppointment),
  };
}

async function assertPatient(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) throw notFound("Patient not found");
}

const list = (patientId: string) =>
  prisma.treatmentRecord.findMany({ where: { patientId }, orderBy: [{ position: "asc" }, { id: "asc" }] });

/** GET /api/patients/:id/treatment-records — the sheet's rows, top to bottom. */
treatmentRecordsRouter.get("/patients/:id/treatment-records", async (req, res) => {
  await assertPatient(req.params.id);
  res.json({ data: (await list(req.params.id)).map(resource) });
});

/**
 * PUT /api/patients/:id/treatment-records — save the whole sheet.
 *
 * Replaces every row in one transaction, so a reordered or shortened sheet is
 * saved exactly as it looks. `{ rows: [] }` clears it.
 */
treatmentRecordsRouter.put("/patients/:id/treatment-records", async (req, res) => {
  await assertActivePatient(req.params.id);
  const { rows } = saveSheet.parse(req.body);
  const patientId = req.params.id;
  await assertPatient(patientId);

  const kept = rows.filter((r) => !isBlank(r));
  await prisma.$transaction([
    prisma.treatmentRecord.deleteMany({ where: { patientId } }),
    prisma.treatmentRecord.createMany({
      data: kept.map((r, position) => ({
        patientId,
        position,
        visitDate: r.visit_date ? new Date(r.visit_date) : null,
        teeth: r.teeth,
        procedure: r.procedure,
        doctor: r.doctor,
        amountCharged: r.amount_charged,
        amountPaid: r.amount_paid,
        nextAppointment: r.next_appointment ? new Date(r.next_appointment) : null,
      })),
    }),
  ]);

  res.json({ data: (await list(patientId)).map(resource) });
});
