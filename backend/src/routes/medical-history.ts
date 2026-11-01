import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";
import { historyData, historyResource, saveHistory } from "../lib/medical-history.js";

// The medical history from the clinic's paper dental record, one per patient:
// Blocks B and C and Section 13 of the Patient Information Record.
// Mounted at /api.
export const medicalHistoryRouter = Router();

async function assertPatient(id: string) {
  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) throw notFound("Patient not found");
}

/** GET /api/patients/:id/medical-history — every answer null until first saved. */
medicalHistoryRouter.get("/patients/:id/medical-history", async (req, res) => {
  await assertPatient(req.params.id);
  const history = await prisma.medicalHistory.findUnique({ where: { patientId: req.params.id } });
  res.json({ data: historyResource(history) });
});

/** PUT /api/patients/:id/medical-history — save the whole form. */
medicalHistoryRouter.put("/patients/:id/medical-history", async (req, res) => {
  const dto = saveHistory.parse(req.body);
  await assertPatient(req.params.id);
  const data = historyData(dto);
  const history = await prisma.medicalHistory.upsert({
    where: { patientId: req.params.id },
    create: { patientId: req.params.id, ...data },
    update: data,
  });
  res.json({ data: historyResource(history) });
});
