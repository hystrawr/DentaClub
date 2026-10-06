import { Router } from "express";
import { z } from "zod";
import { notFound } from "../lib/http-error.js";
import { isoOffset } from "../lib/dates.js";
import * as intake from "../services/intake/intake.js";
import * as links from "../services/intake/links.js";
import {
  intakePacketModel,
  intakeSectionResource,
  intakeSubmissionResource,
} from "../services/intake/mapper.js";

// The patient side: what opens when a patient taps their link.
// Ported from DentalOS's IntakePortalController, minus the patient login — the
// link itself is the credential (encrypted, expiring, single-use).
// Mounted at /api/public/intake.
export const publicIntakeRouter = Router();

const submitResponses = z.object({
  responses: z.record(z.string(), z.unknown(), "The responses field must be an object."),
});

const signIntake = z.object({
  // pdfmake can embed PNG and JPEG only; anything else would fail to render.
  signature_data_uri: z
    .string("The signature data uri field must be a string.")
    .regex(/^data:image\/(png|jpeg);base64,/, "The signature data uri field must be a PNG or JPEG data URI."),
});

/** GET /api/public/intake/:token — the packet to fill in, pre-filled with what we know. */
publicIntakeRouter.get("/:token", async (req, res) => {
  const submission = await links.validate(req.params.token);
  const data = await intake.packetWithPrefill(submission);

  res.json({
    data: {
      packet: intakePacketModel(data.packet),
      sections: data.sections.map(intakeSectionResource),
      payor_type: data.payor_type,
      patient_name: data.patient_name,
      patient_data: data.patient_data,
      submission_id: data.submission_id,
    },
  });
});

/** POST /api/public/intake/:token/submit — save responses and fold them back into the record. */
publicIntakeRouter.post("/:token/submit", async (req, res) => {
  const submission = await links.validate(req.params.token);
  const dto = submitResponses.parse(req.body);
  res.json({ data: intakeSubmissionResource(await intake.submitResponses(submission, dto.responses)) });
});

/** POST /api/public/intake/:token/sign — sign and finalise; produces an immutable document. */
publicIntakeRouter.post("/:token/sign", async (req, res) => {
  const submission = await links.validate(req.params.token);
  const dto = signIntake.parse(req.body);
  res.json({ data: intakeSubmissionResource(await intake.finalize(submission, dto.signature_data_uri)) });
});

/**
 * GET /api/public/intake/:token/status — whether this link has been completed.
 *
 * Readable by hash alone, without the full validation the other routes run — a
 * completed link is exactly what this endpoint exists to report.
 */
publicIntakeRouter.get("/:token/status", async (req, res) => {
  const submission = await links.byTokenHash(req.params.token);
  if (!submission) throw notFound("Intake link not found.");

  res.json({
    data: {
      submission_id: submission.id,
      status: submission.completedAt ? "completed" : "pending",
      completed_at: isoOffset(submission.completedAt),
    },
  });
});
