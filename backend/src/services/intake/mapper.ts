import type {
  IntakePacket,
  IntakePacketItem,
  IntakeSubmission,
  IntakeTemplate,
} from "../../generated/prisma/client.js";
import { isoOffset, isoUtc } from "../../lib/dates.js";
import type { IntakeSection } from "./sections.js";

// Ported from DentalOS apps/api/src/intake/intake.mapper.ts (tenant_id and
// deleted_at removed — this project has neither column).

/** `IntakeTemplateResource` — a picked set of fields, `+08:00` timestamps. */
export function intakeTemplateResource(t: IntakeTemplate) {
  return {
    id: t.id,
    name: t.name,
    version: t.version,
    parent_template_id: t.parentTemplateId,
    fields_schema: t.fieldsSchema,
    is_active: t.isActive,
    created_at: isoOffset(t.createdAt),
    updated_at: isoOffset(t.updatedAt),
  };
}

/** The same template serialised raw, as the packet endpoints nest it. */
function intakeTemplateModel(t: IntakeTemplate) {
  return {
    id: t.id,
    name: t.name,
    version: t.version,
    parent_template_id: t.parentTemplateId,
    fields_schema: t.fieldsSchema,
    is_active: t.isActive,
    created_at: isoUtc(t.createdAt),
    updated_at: isoUtc(t.updatedAt),
  };
}

type PacketItemWithTemplate = IntakePacketItem & { template?: IntakeTemplate | null };

function intakePacketItemModel(item: PacketItemWithTemplate) {
  return {
    id: item.id,
    packet_id: item.packetId,
    template_id: item.templateId,
    sort_order: item.sortOrder,
    is_required: item.isRequired,
    created_at: isoUtc(item.createdAt),
    updated_at: isoUtc(item.updatedAt),
    ...(item.template ? { template: intakeTemplateModel(item.template) } : {}),
  };
}

type PacketWithItems = IntakePacket & { items?: PacketItemWithTemplate[] };

/** Packets go out with their items and each item's template nested. */
export function intakePacketModel(packet: PacketWithItems) {
  return {
    id: packet.id,
    name: packet.name,
    description: packet.description,
    is_active: packet.isActive,
    created_at: isoUtc(packet.createdAt),
    updated_at: isoUtc(packet.updatedAt),
    ...(packet.items ? { items: packet.items.map(intakePacketItemModel) } : {}),
  };
}

/**
 * One wizard section, for the public route only. `template_id` is the one
 * internal id that goes out — the form needs a stable handle on which template
 * an answer belongs to — and no packet-item id.
 */
export function intakeSectionResource(section: IntakeSection) {
  return {
    key: section.key,
    title: section.title,
    template_id: section.templateId,
    required: section.required,
    show_if: section.showIf,
    fields: section.fields.map((field) => ({
      key: field.key,
      type: field.type,
      label: field.label,
      required: field.required,
      ...(field.options ? { options: field.options } : {}),
    })),
  };
}

/**
 * `IntakeSubmissionResource`.
 *
 * `token_hash` is deliberately absent. It is the only server-side trace of the
 * link, and publishing it would let anyone holding a candidate token confirm a
 * hit offline.
 */
export function intakeSubmissionResource(s: IntakeSubmission) {
  return {
    id: s.id,
    patient_id: s.patientId,
    packet_id: s.packetId,
    appointment_id: s.appointmentId,
    status: s.completedAt ? "completed" : "pending",
    responses: s.responses,
    completed_at: isoOffset(s.completedAt),
    document_id: s.documentId,
    created_at: isoOffset(s.createdAt),
  };
}
