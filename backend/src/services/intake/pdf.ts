import type { Content, TDocumentDefinitions } from "pdfmake/interfaces.js";

// Ported from DentalOS apps/api/src/intake/intake-pdf.ts. The only change is the
// footer, which named the clinic's tenant id — there are no tenants here.

/** One field as the template declares it. */
export interface IntakeField {
  key: string;
  label: string;
  type: string;
}

/** One template's worth of the packet, with the answers given to it. */
interface IntakePdfSection {
  templateName: string;
  fields: IntakeField[];
}

export interface IntakeDocumentInput {
  packetName: string;
  patientName: string;
  submissionId: string;
  signedAt: Date;
  sections: IntakePdfSection[];
  responses: Record<string, unknown>;
  /** `data:image/png;base64,…` from the signature pad. */
  signatureDataUri: string | null;
}

const MANILA = "Asia/Manila";

function longDateTime(at: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: MANILA,
  }).format(at);
}

function longDate(at: Date): string {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "long", timeZone: MANILA }).format(at);
}

/**
 * How an answer is written down.
 *
 * A checkbox group arrives as an array and a yes/no as a boolean. An unanswered
 * optional field prints an em dash rather than nothing, so that a blank on the
 * page is visibly a blank rather than a field that failed to render — on a
 * signed medical form the difference matters.
 */
function formatResponse(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/**
 * The signed intake packet, as filed: the packet name, who filled it in, every
 * field with its answer grouped by template, then the signature image and when
 * it was drawn.
 *
 * Two field types are deliberately not printed as answers. A `consent_html`
 * field is a wall of terms whose *answer* is the act of signing, so it records
 * that it was reviewed; a `signature` field is the image at the foot of the
 * document and would otherwise print a base64 blob into the body.
 */
export function buildIntakeDocument(input: IntakeDocumentInput): TDocumentDefinitions {
  const body: Content[] = [
    { text: input.packetName, style: "title" },
    {
      style: "meta",
      text: [
        `Patient: ${input.patientName}\n`,
        `Submission ID: ${input.submissionId}\n`,
        `Signed at: ${longDateTime(input.signedAt)}`,
      ],
    },
  ];

  for (const section of input.sections) {
    body.push({ text: section.templateName, style: "section" });
    for (const field of section.fields) {
      if (field.type === "signature") continue;
      const answer =
        field.type === "consent_html"
          ? "[Consent reviewed and accepted]"
          : formatResponse(input.responses[field.key]);
      body.push({
        style: "field",
        text: [{ text: `${field.label}: `, bold: true }, answer],
      });
    }
  }

  body.push({
    style: "signatureBlock",
    stack: [
      { text: "Patient Signature", bold: true, margin: [0, 0, 0, 6] },
      input.signatureDataUri
        ? { image: input.signatureDataUri, fit: [300, 100] }
        : { text: "No signature captured.", italics: true },
      {
        text: `Signed electronically on ${longDateTime(input.signedAt)}`,
        margin: [0, 6, 0, 0],
      },
    ],
  });

  return {
    info: { title: `${input.packetName} — ${input.patientName}` },
    content: body,
    footer: () => ({
      style: "footer",
      text: `DentaClub — This document is immutable once generated. ${longDate(input.signedAt)}`,
    }),
    styles: {
      title: { fontSize: 18, bold: true, margin: [0, 0, 0, 4] },
      meta: { fontSize: 9, color: "#555555", margin: [0, 0, 0, 16] },
      section: { fontSize: 13, bold: true, margin: [0, 16, 0, 6] },
      field: { fontSize: 10, margin: [0, 0, 0, 6] },
      signatureBlock: { margin: [0, 24, 0, 0] },
      footer: { fontSize: 8, color: "#888888", margin: [40, 12, 40, 0] },
    },
  };
}
