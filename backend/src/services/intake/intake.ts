import type { IntakeSubmission, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { HttpError, notFound, ruleViolation } from "../../lib/http-error.js";
import { ageFrom, dateString } from "../../lib/dates.js";
import { renderPdf } from "../../lib/pdf.js";
import { buildIntakeDocument, type IntakeField } from "./pdf.js";
import { buildSections, missingRequiredFields, type IntakeSection } from "./sections.js";

// Ported from DentalOS apps/api/src/intake/intake.service.ts.
//
// Differences, all because the mini project has no such table:
//  - no MedicalProfile, so medical answers are stored in `responses` only;
//  - no payor on appointments, so every patient is self-pay for `show_if`;
//  - the signed PDF is stored in `documents.file_data` instead of Cloudflare R2.

/**
 * Patient fields the intake form is allowed to write back. (DentalOS also
 * allows city and province, which this Patient table does not have.)
 */
const PATIENT_FIELDS: Record<string, string> = {
  first_name: "firstName",
  last_name: "lastName",
  middle_name: "middleName",
  email: "email",
  mobile: "mobile",
  address: "address",
};

const PACKET_INCLUDE = {
  items: {
    include: { template: true },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
};

/**
 * The packet a patient is being asked to fill in, plus what the clinic already
 * knows about them.
 *
 * Pre-filling is not a convenience feature — a form that asks a returning
 * patient to retype their details is a form that gets a shorter answer than the
 * one on file. Null fields are dropped so the form can tell "we have nothing"
 * from "we have an empty string".
 */
export async function packetWithPrefill(submission: IntakeSubmission) {
  const packet = await prisma.intakePacket.findUnique({
    where: { id: submission.packetId },
    include: PACKET_INCLUDE,
  });
  if (!packet) throw notFound(`No intake packet ${submission.packetId}`);

  const patient = await prisma.patient.findUnique({ where: { id: submission.patientId } });
  if (!patient) throw notFound(`No patient ${submission.patientId}`);

  const payorType = await payorTypeFor(submission);

  const prefill: Record<string, unknown> = {
    first_name: patient.firstName,
    last_name: patient.lastName,
    middle_name: patient.middleName,
    date_of_birth: dateString(patient.dateOfBirth),
    sex: patient.sex,
    email: patient.email,
    mobile: patient.mobile,
    address: patient.address,
  };

  return {
    packet,
    sections: buildSections(packet.items, { payorType }),
    // Returned so the client can evaluate `show_if` directly.
    payor_type: payorType,
    patient_name: `${patient.firstName} ${patient.lastName}`,
    patient_data: Object.fromEntries(Object.entries(prefill).filter(([, v]) => v !== null && v !== undefined)),
    submission_id: submission.id,
  };
}

/**
 * Save the responses, and fold the answers back into the patient record.
 *
 * The write-back is allow-listed: a form can correct a phone number, and nothing
 * else. Without the allow-list, a crafted response body would be a direct write
 * into the patient table.
 *
 * **This is a complete submission, not a partial save.** The required-field
 * check runs here because this is where a 422 can name the field the patient
 * still has to fill — rather than refusing at `sign`, after they have already
 * drawn their signature.
 */
export async function submitResponses(submission: IntakeSubmission, responses: Record<string, unknown>) {
  await assertRequiredAnswered(submission, responses);

  await prisma.intakeSubmission.update({
    where: { id: submission.id },
    data: { responses: responses as Prisma.InputJsonObject },
  });

  const patientUpdates = pick(responses, PATIENT_FIELDS);
  if (Object.keys(patientUpdates).length > 0) {
    await prisma.patient.update({ where: { id: submission.patientId }, data: patientUpdates });
  }

  return reload(submission.id);
}

/**
 * Finalise: check consent, record the signed document, close the submission.
 *
 * A **minor cannot consent for themselves**. If the patient is under 18 there
 * must be a guardian link marked with consent authority on file, or signing is
 * refused.
 *
 * The document row is written with `immutableFlag`: what was signed is a legal
 * artifact and the record of it must not be editable afterwards.
 */
export async function finalize(submission: IntakeSubmission, signatureDataUri: string) {
  if (submission.completedAt) {
    throw ruleViolation("This submission has already been finalized.");
  }

  const patient = await prisma.patient.findUnique({ where: { id: submission.patientId } });
  if (!patient) throw notFound(`No patient ${submission.patientId}`);

  if ((ageFrom(patient.dateOfBirth) ?? 0) < 18) {
    const guardian = await prisma.guardianLink.findFirst({
      where: { wardPatientId: patient.id, consentAuthorityFlag: true },
    });
    if (!guardian) {
      throw new HttpError(
        403,
        "An authorized guardian must be on file before signing intake forms for a minor patient.",
      );
    }
  }

  // Re-checked at the gate, not merely at submission: `sign` is its own endpoint
  // and can be called without `submit` ever having run. A signature over a
  // half-empty consent packet is a worse artifact than a 422.
  await assertRequiredAnswered(submission, asRecord(submission.responses));

  const packet = await prisma.intakePacket.findUnique({ where: { id: submission.packetId } });
  const packetName = packet?.name ?? "Packet";
  const signedAt = new Date();

  const pdf = await renderSubmission(submission, patient, packetName, signatureDataUri, signedAt);

  // One transaction, and the submission is closed only if it is still open.
  // Without the `completedAt: null` condition, two sign requests arriving
  // together would both pass the check above and file two signed documents.
  await prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        patientId: submission.patientId,
        type: "signed_consent",
        title: `Intake: ${packetName}`,
        fileData: new Uint8Array(pdf),
        mimeType: "application/pdf",
        fileName: `intake-${submission.id}.pdf`,
        sizeBytes: pdf.length,
        immutableFlag: true,
      },
    });

    const closed = await tx.intakeSubmission.updateMany({
      where: { id: submission.id, completedAt: null },
      data: { completedAt: signedAt, documentId: document.id },
    });
    if (closed.count === 0) {
      throw ruleViolation("This submission has already been finalized.");
    }
  });

  return reload(submission.id);
}

/**
 * Render the packet exactly as it was answered.
 *
 * The templates are read at signing time because the document has to show the
 * questions as well as the answers — a list of values with no labels is not a
 * consent record. Templates are versioned and a packet item points at one
 * version, so what is rendered is the wording the patient actually saw.
 */
async function renderSubmission(
  submission: IntakeSubmission,
  patient: { firstName: string; lastName: string },
  packetName: string,
  signatureDataUri: string,
  signedAt: Date,
): Promise<Buffer> {
  const items = await prisma.intakePacketItem.findMany({
    where: { packetId: submission.packetId },
    include: { template: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const sections = items.map((item) => ({
    templateName: item.template.name,
    fields: (Array.isArray(item.template.fieldsSchema) ? item.template.fieldsSchema : []).flatMap(
      (field): IntakeField[] => {
        if (!field || typeof field !== "object" || Array.isArray(field)) return [];
        const { key, label, type } = field as Record<string, unknown>;
        if (typeof key !== "string") return [];
        return [{ key, label: typeof label === "string" ? label : key, type: String(type ?? "text") }];
      },
    ),
  }));

  return renderPdf(
    buildIntakeDocument({
      packetName,
      patientName: `${patient.lastName}, ${patient.firstName}`,
      submissionId: submission.id,
      signedAt,
      sections,
      responses: asRecord(submission.responses),
      signatureDataUri: signatureDataUri || null,
    }),
  );
}

/** The packet's sections, resolved against this submission's payor context. */
async function sectionsFor(submission: IntakeSubmission): Promise<IntakeSection[]> {
  const items = await prisma.intakePacketItem.findMany({
    where: { packetId: submission.packetId },
    include: { template: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return buildSections(items, { payorType: await payorTypeFor(submission) });
}

/**
 * The payor the appointment was booked under. The mini project does not record
 * payors, so this is always null — which `sectionApplies` reads as self-pay,
 * hiding any HMO section.
 */
async function payorTypeFor(_submission: IntakeSubmission): Promise<string | null> {
  return null;
}

/**
 * Refuse a submission that leaves a *visible* required field blank.
 *
 * A hidden section is not required of this patient, so the self-pay patient is
 * never blocked by an HMO member number they were never shown. Error keys are
 * under `responses.` so the form can paint them onto the inputs it rendered.
 */
async function assertRequiredAnswered(
  submission: IntakeSubmission,
  responses: Record<string, unknown>,
): Promise<void> {
  const missing = missingRequiredFields(await sectionsFor(submission), responses);
  if (missing.length === 0) return;

  throw ruleViolation(
    "Validation failed.",
    Object.fromEntries(
      missing.map((key) => [`responses.${key}`, [`The ${key.replace(/_/g, " ")} field is required.`]]),
    ),
  );
}

async function reload(id: string) {
  const submission = await prisma.intakeSubmission.findUnique({ where: { id } });
  if (!submission) throw notFound(`No intake submission ${id}`);
  return submission;
}

/**
 * `responses` is a nullable JSONB column. An unanswered packet and a malformed
 * one are the same thing here: nothing has been answered.
 */
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/**
 * Only string answers are written back — every allow-listed column is text, and
 * a number or array would make the update fail.
 */
function pick(responses: Record<string, unknown>, allowed: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [wire, column] of Object.entries(allowed)) {
    const value = responses[wire];
    if (typeof value === "string") out[column] = value;
  }
  return out;
}
