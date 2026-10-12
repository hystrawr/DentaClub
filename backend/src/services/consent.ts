import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces.js";
import type { Consent, Patient } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { HttpError, notFound, ruleViolation } from "../lib/http-error.js";
import { ageFrom, dateString, isoOffset } from "../lib/dates.js";
import { renderPdf } from "../lib/pdf.js";

// The clinic's one consent form, signed on the clinic's device.
//
// The wording is a plain text file the clinic edits (backend/consent-form.txt).
// It is read on every request, so an edit shows up without a restart, and it is
// copied into each Consent row at signing, so an edit never changes what an
// earlier patient agreed to.

const FORM_PATH = new URL("../../consent-form.txt", import.meta.url);

/** Left in the starter file; while it is there the form has not been written yet. */
const PLACEHOLDER_MARKER = "[REPLACE THIS TEXT]";

export interface ConsentForm {
  text: string;
  /** Identifies this exact wording, so signing can refuse a form that changed mid-read. */
  version: string;
  is_placeholder: boolean;
}

export async function readForm(): Promise<ConsentForm> {
  const text = (await readFile(FORM_PATH, "utf-8")).replace(/\r\n/g, "\n").trim();
  return {
    text,
    version: createHash("sha256").update(text).digest("hex").slice(0, 16),
    is_placeholder: text.includes(PLACEHOLDER_MARKER),
  };
}

const fullName = (p: Pick<Patient, "firstName" | "middleName" | "lastName">): string =>
  `${p.firstName} ${p.middleName ?? ""} ${p.lastName}`.replace(/\s+/g, " ").trim();

export interface SignInput {
  formVersion: string;
  signatureDataUri: string;
  /** Required for a minor: the parent or guardian signing for them. */
  signerName?: string | null;
  signerRelationship?: string | null;
}

/**
 * Record a signing: the PDF and the Consent row are written together, or not
 * at all.
 *
 * A patient under 18 cannot consent for themselves, so for a minor the name and
 * relationship of the adult signing are required. An adult always signs as
 * themselves.
 */
export async function sign(patientId: string, input: SignInput): Promise<Consent> {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw notFound(`No patient ${patientId}`);

  const form = await readForm();
  if (input.formVersion !== form.version) {
    throw new HttpError(409, "The consent form was changed while it was open. Reload the page and sign the current version.");
  }

  const patientName = fullName(patient);
  const isMinor = (ageFrom(patient.dateOfBirth) ?? 0) < 18;
  let signerName = patientName;
  let signerRelationship: string | null = null;

  if (isMinor) {
    signerName = input.signerName?.trim() ?? "";
    signerRelationship = input.signerRelationship?.trim() ?? "";
    const errors: Record<string, string[]> = {};
    if (!signerName) errors.signer_name = ["Enter the name of the parent or guardian signing."];
    if (!signerRelationship) errors.signer_relationship = ["Enter how they are related to the patient."];
    if (Object.keys(errors).length) {
      throw ruleViolation("This patient is under 18, so a parent or guardian must sign.", errors);
    }
  }

  const signedAt = new Date();
  const pdf = await renderPdf(
    consentDocument({
      formText: form.text,
      patientName,
      dateOfBirth: dateString(patient.dateOfBirth),
      signerName,
      signerRelationship,
      signatureDataUri: input.signatureDataUri,
      signedAt,
    }),
  );

  return prisma.$transaction(async (tx) => {
    const document = await tx.document.create({
      data: {
        patientId,
        type: "signed_consent",
        title: "Consent Form",
        fileData: new Uint8Array(pdf),
        mimeType: "application/pdf",
        fileName: `consent-${patient.lastName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dateString(signedAt)}.pdf`,
        sizeBytes: pdf.length,
        immutableFlag: true,
      },
    });

    return tx.consent.create({
      data: {
        patientId,
        formText: form.text,
        signerName,
        signerRelationship,
        signatureImage: input.signatureDataUri,
        documentId: document.id,
        signedAt,
      },
    });
  });
}

/**
 * The patient's current consent (the latest signing), and every earlier signed
 * PDF — earlier signings here, and those from the old multi-form system.
 */
export async function forPatient(patientId: string) {
  const [current, documents] = await Promise.all([
    prisma.consent.findFirst({ where: { patientId }, orderBy: [{ signedAt: "desc" }, { id: "desc" }] }),
    prisma.document.findMany({
      where: { patientId, type: "signed_consent" },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      omit: { fileData: true },
    }),
  ]);

  return {
    current: current && {
      id: current.id,
      form_text: current.formText,
      signer_name: current.signerName,
      signer_relationship: current.signerRelationship,
      signature_image: current.signatureImage,
      document_id: current.documentId,
      signed_at: isoOffset(current.signedAt),
    },
    previous: documents
      .filter((d) => d.id !== current?.documentId)
      .map((d) => ({ document_id: d.id, title: d.title, size_bytes: d.sizeBytes, signed_at: isoOffset(d.createdAt) })),
  };
}

/* ── PDF ───────────────────────────────────────────────────────────────── */

const MANILA = "Asia/Manila";
const longDateTime = (at: Date) =>
  new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeStyle: "short", timeZone: MANILA }).format(at);

interface ConsentPdfInput {
  formText: string;
  patientName: string;
  dateOfBirth: string | null;
  signerName: string;
  signerRelationship: string | null;
  signatureDataUri: string;
  signedAt: Date;
}

/** Blank-line-separated paragraphs; a paragraph starting with "# " is a heading. */
function formBody(text: string): Content[] {
  return text.split(/\n\s*\n/).map((block) =>
    block.startsWith("# ")
      ? { text: block.slice(2).trim(), style: "heading" }
      : { text: block.trim(), style: "paragraph" },
  );
}

function consentDocument(input: ConsentPdfInput): TDocumentDefinitions {
  const signedFor = input.signerRelationship
    ? `${input.signerName} (${input.signerRelationship}), on behalf of ${input.patientName}`
    : input.signerName;

  // The form's own title, when it opens with one, goes above the patient's details.
  const body = formBody(input.formText);
  const title = input.formText.startsWith("# ") ? body.splice(0, 1) : [];

  return {
    info: { title: `Consent Form — ${input.patientName}` },
    content: [
      ...title,
      {
        style: "meta",
        text: [
          `Patient: ${input.patientName}\n`,
          ...(input.dateOfBirth ? [`Date of birth: ${input.dateOfBirth}\n`] : []),
        ],
      },
      ...body,
      {
        style: "signatureBlock",
        stack: [
          { image: input.signatureDataUri, fit: [260, 90] },
          { canvas: [{ type: "line", x1: 0, y1: 0, x2: 260, y2: 0, lineWidth: 0.5 }] },
          { text: signedFor, bold: true, margin: [0, 4, 0, 0] },
          { text: `Signed electronically on ${longDateTime(input.signedAt)}`, style: "meta" },
        ],
      },
    ],
    footer: () => ({ style: "footer", text: "DentaClub — This document is immutable once generated." }),
    styles: {
      heading: { fontSize: 14, bold: true, margin: [0, 10, 0, 6] },
      paragraph: { fontSize: 10, margin: [0, 0, 0, 8] },
      meta: { fontSize: 9, color: "#555555", margin: [0, 0, 0, 12] },
      signatureBlock: { margin: [0, 24, 0, 0] },
      footer: { fontSize: 8, color: "#888888", margin: [40, 12, 40, 0] },
    },
  };
}
