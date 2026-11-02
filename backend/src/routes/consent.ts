import { Router } from "express";
import { z } from "zod";
import * as consent from "../services/consent.js";

// The clinic's consent form and each patient's signed copy. Mounted at /api.
export const consentRouter = Router();

const signConsent = z.object({
  form_version: z.string().min(1, "The form version field is required."),
  // pdfmake can embed PNG and JPEG only; anything else would fail to render.
  signature_data_uri: z
    .string("The signature field must be a string.")
    .regex(/^data:image\/(png|jpeg);base64,/, "The signature must be a PNG or JPEG image."),
  signer_name: z.string().max(255).nullish(),
  signer_relationship: z.string().max(100).nullish(),
});

/** GET /api/consent-form — the wording to show before signing. */
consentRouter.get("/consent-form", async (_req, res) => {
  res.json({ data: await consent.readForm() });
});

/** GET /api/patients/:id/consent — current consent (or null) and earlier signed PDFs. */
consentRouter.get("/patients/:id/consent", async (req, res) => {
  res.json({ data: await consent.forPatient(req.params.id) });
});

/** GET /api/consents/:id/signature — the signature image. A signing never changes, so it caches for good. */
consentRouter.get("/consents/:id/signature", async (req, res) => {
  const { mimeType, bytes } = await consent.signatureImage(req.params.id);
  res.type(mimeType).set("Cache-Control", "private, max-age=31536000, immutable").send(bytes);
});

/** POST /api/patients/:id/consent — sign. Signing again keeps the earlier copy. */
consentRouter.post("/patients/:id/consent", async (req, res) => {
  const dto = signConsent.parse(req.body);
  await consent.sign(req.params.id, {
    formVersion: dto.form_version,
    signatureDataUri: dto.signature_data_uri,
    signerName: dto.signer_name,
    signerRelationship: dto.signer_relationship,
  });
  res.status(201).json({ data: await consent.forPatient(req.params.id) });
});
