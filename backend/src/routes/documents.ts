import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../lib/http-error.js";
import { isoOffset } from "../lib/dates.js";

// Patient documents — for now, the signed consent PDFs. Mounted at /api.
export const documentsRouter = Router();

/** GET /api/patients/:id/documents — newest first, without the file bytes. */
documentsRouter.get("/patients/:id/documents", async (req, res) => {
  const rows = await prisma.document.findMany({
    where: { patientId: req.params.id },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    omit: { fileData: true },
  });

  res.json({
    data: rows.map((d) => ({
      id: d.id,
      patient_id: d.patientId,
      type: d.type,
      title: d.title,
      file_name: d.fileName,
      mime_type: d.mimeType,
      size_bytes: d.sizeBytes,
      immutable: d.immutableFlag,
      created_at: isoOffset(d.createdAt),
    })),
  });
});

/** GET /api/documents/:id/file — the PDF itself, shown inline in the browser. */
documentsRouter.get("/documents/:id/file", async (req, res) => {
  const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!doc?.fileData) throw notFound("Document has no file.");

  res
    .type(doc.mimeType ?? "application/octet-stream")
    .set("Content-Disposition", `inline; filename="${doc.fileName ?? `${doc.id}.pdf`}"`)
    .send(Buffer.from(doc.fileData));
});
