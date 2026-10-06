import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { invalidField, notFound } from "../lib/http-error.js";
import { isoOffset } from "../lib/dates.js";
import { paginate, readPageRequest } from "../lib/pagination.js";
import * as links from "../services/intake/links.js";
import {
  intakePacketModel,
  intakeSubmissionResource,
  intakeTemplateResource,
} from "../services/intake/mapper.js";

// Staff side of consent & intake. Ported from DentalOS
// apps/api/src/intake/intake.controller.ts. Mounted at /api/intake.
export const intakeRouter = Router();

/** Field types an intake template may declare. */
const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "checkbox",
  "checkboxes",
  "radio",
  "select",
  "signature",
] as const;

const templateField = z.object({
  key: z.string().min(1, "The key field is required."),
  type: z.enum(FIELD_TYPES, "The selected type is invalid."),
  label: z.string().min(1, "The label field is required."),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  /** Optional finer grouping inside one template. */
  section: z.string().optional(),
});

const fieldsSchema = z.array(templateField).min(1, "The fields schema field must have at least 1 items.");

const createTemplate = z.object({
  name: z.string().min(1, "The name field is required.").max(255),
  fields_schema: fieldsSchema,
  is_active: z.boolean().optional(),
});

/** A new version. `name` carries over from the parent when omitted. */
const versionTemplate = z.object({
  name: z.string().max(255).optional(),
  fields_schema: fieldsSchema,
});

const createPacket = z.object({
  name: z.string().min(1, "The name field is required.").max(255),
  description: z.string().nullish(),
  items: z
    .array(
      z.object({
        template_id: z.string().min(1, "The template id field is required."),
        sort_order: z.number().int().min(0).optional(),
        is_required: z.boolean().optional(),
      }),
    )
    .min(1, "The items field must have at least 1 items."),
  is_active: z.boolean().optional(),
});

const updatePacket = z.object({
  name: z.string().max(255).optional(),
  description: z.string().nullish(),
  is_active: z.boolean().optional(),
});

const generateLink = z.object({
  patient_id: z.string().min(1, "The patient id field is required."),
  packet_id: z.string().min(1, "The packet id field is required."),
  appointment_id: z.string().nullish(),
});

const PACKET_INCLUDE = {
  items: {
    include: { template: true },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
};

async function templateOrFail(id: string) {
  const template = await prisma.intakeTemplate.findUnique({ where: { id } });
  if (!template) throw notFound(`No intake template ${id}`);
  return template;
}

async function packetOrFail(id: string) {
  const packet = await prisma.intakePacket.findUnique({ where: { id }, include: PACKET_INCLUDE });
  if (!packet) throw notFound(`No intake packet ${id}`);
  return packet;
}

/* ── Templates ──────────────────────────────────────────────────────────── */

/**
 * Active templates only. Superseded versions stay in the table — a submission
 * signed against v1 must still resolve to the v1 questions — but they are not
 * offered for new packets.
 */
intakeRouter.get("/templates", async (_req, res) => {
  const rows = await prisma.intakeTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
  res.json({ data: rows.map(intakeTemplateResource) });
});

intakeRouter.post("/templates", async (req, res) => {
  const dto = createTemplate.parse(req.body);
  const created = await prisma.intakeTemplate.create({
    data: {
      name: dto.name,
      fieldsSchema: dto.fields_schema as Prisma.InputJsonArray,
      isActive: dto.is_active ?? true,
      version: 1,
    },
  });
  res.status(201).json({ data: intakeTemplateResource(created) });
});

intakeRouter.get("/templates/:id", async (req, res) => {
  res.json({ data: intakeTemplateResource(await templateOrFail(req.params.id)) });
});

/**
 * Supersede a template with a new version.
 *
 * The old row is **kept** and deactivated, never edited. A consent form that has
 * been signed has to stay readable exactly as it was worded when it was signed —
 * that is the entire reason templates are versioned rather than mutable.
 */
intakeRouter.post("/templates/:id/version", async (req, res) => {
  const dto = versionTemplate.parse(req.body);
  const parent = await templateOrFail(req.params.id);

  const created = await prisma.$transaction(async (tx) => {
    const next = await tx.intakeTemplate.create({
      data: {
        name: dto.name ?? parent.name,
        fieldsSchema: dto.fields_schema as Prisma.InputJsonArray,
        version: parent.version + 1,
        parentTemplateId: parent.id,
        isActive: true,
      },
    });
    await tx.intakeTemplate.update({ where: { id: parent.id }, data: { isActive: false } });
    return next;
  });

  res.status(201).json({ data: intakeTemplateResource(created) });
});

/* ── Packets ────────────────────────────────────────────────────────────── */

intakeRouter.get("/packets", async (_req, res) => {
  const rows = await prisma.intakePacket.findMany({
    where: { isActive: true },
    include: PACKET_INCLUDE,
    orderBy: { id: "asc" },
  });
  res.json({ data: rows.map(intakePacketModel) });
});

intakeRouter.post("/packets", async (req, res) => {
  const dto = createPacket.parse(req.body);

  for (const item of dto.items) {
    const template = await prisma.intakeTemplate.findUnique({ where: { id: item.template_id } });
    if (!template) throw invalidField("items.template_id");
  }

  const packet = await prisma.intakePacket.create({
    data: {
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.is_active ?? true,
      items: {
        create: dto.items.map((item, index) => ({
          templateId: item.template_id,
          sortOrder: item.sort_order ?? index,
          isRequired: item.is_required ?? true,
        })),
      },
    },
  });

  res.status(201).json({ data: intakePacketModel(await packetOrFail(packet.id)) });
});

intakeRouter.get("/packets/:id", async (req, res) => {
  res.json({ data: intakePacketModel(await packetOrFail(req.params.id)) });
});

/** Rename or retire a packet. */
intakeRouter.patch("/packets/:id", async (req, res) => {
  const dto = updatePacket.parse(req.body);
  await packetOrFail(req.params.id);

  await prisma.intakePacket.update({
    where: { id: req.params.id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.is_active !== undefined ? { isActive: dto.is_active } : {}),
    },
  });

  res.json({ data: intakePacketModel(await packetOrFail(req.params.id)) });
});

/* ── Links ──────────────────────────────────────────────────────────────── */

/**
 * Mint a link for a patient. The token is returned **once** — the server keeps
 * only its hash, so a link that is lost has to be re-issued rather than looked up.
 */
intakeRouter.post("/links", async (req, res) => {
  const dto = generateLink.parse(req.body);

  const patient = await prisma.patient.findUnique({ where: { id: dto.patient_id } });
  if (!patient) throw invalidField("patient_id");

  const packet = await prisma.intakePacket.findUnique({ where: { id: dto.packet_id } });
  if (!packet) throw invalidField("packet_id");

  if (dto.appointment_id) {
    const appointment = await prisma.appointment.findUnique({ where: { id: dto.appointment_id } });
    if (!appointment) throw invalidField("appointment_id");
  }

  const { token, expiresAt, submission } = await links.generate(
    dto.patient_id,
    dto.packet_id,
    dto.appointment_id ?? null,
  );

  const frontend = process.env.FRONTEND_URL ?? "http://localhost:3000";

  res.status(201).json({
    data: {
      token,
      expires_at: isoOffset(expiresAt),
      submission_id: submission.id,
      // Not in DentalOS: the full link, ready to copy or text to the patient.
      url: `${frontend}/intake/${encodeURIComponent(token)}`,
    },
  });
});

/* ── Submissions (staff view) ───────────────────────────────────────────── */

const isTruthy = (value: string): boolean => ["1", "true", "yes", "on"].includes(value.toLowerCase());

/** Newest first. `id` breaks the tie on `created_at` so pages never repeat or skip rows. */
intakeRouter.get("/submissions", async (req, res) => {
  const page = readPageRequest(req.query);
  const patientId = typeof req.query.patient_id === "string" ? req.query.patient_id : undefined;
  const completed = typeof req.query.completed === "string" ? req.query.completed : undefined;

  const where: Prisma.IntakeSubmissionWhereInput = {
    ...(patientId ? { patientId } : {}),
    ...(completed === undefined || completed === ""
      ? {}
      : isTruthy(completed)
        ? { completedAt: { not: null } }
        : { completedAt: null }),
  };

  const [rows, total] = await Promise.all([
    prisma.intakeSubmission.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page.page - 1) * page.perPage,
      take: page.perPage,
    }),
    prisma.intakeSubmission.count({ where }),
  ]);

  res.json(paginate(rows.map(intakeSubmissionResource), total, page, req));
});

intakeRouter.get("/submissions/:id", async (req, res) => {
  const submission = await prisma.intakeSubmission.findUnique({ where: { id: req.params.id } });
  if (!submission) throw notFound(`No intake submission ${req.params.id}`);
  res.json({ data: intakeSubmissionResource(submission) });
});
