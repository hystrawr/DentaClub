import type { OdontogramEvent } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { allowedFindings, chartingRefusal, FOUNDATION_CODES, isValidFdi } from "./chart.js";
import { notFound, ruleViolation } from "../lib/http-error.js";
import { assertActivePatient } from "./patients.js";

/**
 * The dental chart is **append-only**: no row is ever updated or deleted. A
 * mistake is fixed by a new event that names the one it replaces (a correction)
 * or withdraws it (entered in error), so the full history stays on record, as
 * a clinical record must.
 */

export interface AppendEventInput {
  tooth_number: number;
  event_type: string;
  surfaces?: string[] | null;
  condition_code?: string | null;
  replaces_event_id?: number | null;
  supersession_type?: string | null;
  supersession_reason?: string | null;
  observed_at?: string | null;
  notes?: string | null;
}

export async function append(patientId: string, dto: AppendEventInput) {
  if (!isValidFdi(dto.tooth_number)) {
    throw ruleViolation(`Invalid FDI tooth number: ${dto.tooth_number}`);
  }

  await assertActivePatient(patientId);

  const replacesEventId = dto.replaces_event_id != null ? BigInt(dto.replaces_event_id) : null;

  if (replacesEventId !== null) {
    await assertSupersedable(patientId, replacesEventId);
  }

  if (dto.supersession_type === "entered-in-error" && !dto.supersession_reason?.trim()) {
    throw ruleViolation("A retracted event must say why it was retracted.");
  }

  // A new finding must make sense on the tooth as it stood at that moment: no
  // filling on a missing tooth, nothing on a removable denture. Corrections and
  // retractions (an entry that replaces another) are how a wrong finding is
  // fixed, so they are never refused here.
  const observedAt = dto.observed_at ? new Date(dto.observed_at) : new Date();
  if (replacesEventId === null && dto.condition_code) {
    const foundation = await foundationOf(patientId, dto.tooth_number, observedAt);
    const refusal = chartingRefusal(dto.tooth_number, foundation, dto.condition_code);
    if (refusal) throw ruleViolation(refusal);
  }

  return prisma.odontogramEvent.create({
    data: {
      patientId,
      toothNumber: dto.tooth_number,
      eventType: dto.event_type,
      surfaces: dto.surfaces ?? undefined,
      conditionCode: dto.condition_code ?? null,
      replacesEventId,
      supersessionType: dto.supersession_type ?? null,
      supersessionReason: dto.supersession_reason ?? null,
      // When the finding was true: now, or the date of a past visit being charted.
      observedAt,
      notes: dto.notes ?? null,
    },
  });
}

/**
 * The target of a supersession must exist, belong to this patient, and not
 * already be superseded.
 */
async function assertSupersedable(patientId: string, replacesEventId: bigint): Promise<void> {
  const target = await prisma.odontogramEvent.findFirst({
    where: { id: replacesEventId, patientId },
  });

  if (!target) {
    throw notFound(`No odontogram event ${replacesEventId} for this patient`);
  }

  const already = await prisma.odontogramEvent.findFirst({
    where: { replacesEventId },
    select: { id: true },
  });

  if (already) {
    throw ruleViolation(
      `Event ${replacesEventId} has already been superseded by ${already.id}. Supersede the current entry instead.`,
    );
  }
}

/**
 * The chart as it stands: `tooth → surface → event`, applying events in the
 * order they were true. The `*` key is the whole tooth; a whole-tooth finding
 * (missing, implant, crown) clears the surfaces beneath it. `base` is what that
 * finding sits on, when it is allowed to: the implant under a crown, the
 * missing tooth under a pontic.
 */
export async function surfaceState(
  patientId: string,
  asOf?: Date,
): Promise<Record<number, Record<string, OdontogramEvent>>> {
  const events = await loadEvents(patientId, asOf);
  const superseded = supersededIds(events);

  const state: Record<number, Record<string, OdontogramEvent>> = {};

  for (const event of events) {
    if (superseded.has(String(event.id))) continue;
    if (event.supersessionType === "entered-in-error") continue;

    const tooth = (state[event.toothNumber] ??= {});
    const surfaces = surfacesOf(event);

    if (surfaces.length === 0) {
      // A crown on an implant, or a pontic where a tooth is missing, sits on
      // top of what the tooth is: keep that under `base` so it is still drawn.
      const below = tooth["*"];
      const sitsOnBelow = below?.conditionCode != null && event.conditionCode != null
        && (allowedFindings(below.conditionCode)?.includes(event.conditionCode) ?? false);
      state[event.toothNumber] = sitsOnBelow ? { base: below!, "*": event } : { "*": event };
      continue;
    }

    // A surface finding replaces an earlier whole-tooth one.
    delete tooth["*"];
    delete tooth.base;
    for (const surface of surfaces) tooth[surface] = event;
  }

  return state;
}

/**
 * What the tooth is at `asOf`: its latest standing missing, extraction,
 * implant, pontic or denture finding, or undefined for a natural tooth. An
 * entry replaced by a correction, or marked entered in error, no longer stands.
 * Unlike the surface fold, a crown on an implant does not hide the implant.
 */
async function foundationOf(patientId: string, toothNumber: number, asOf: Date): Promise<string | undefined> {
  const events = await loadEvents(patientId, asOf);
  const superseded = supersededIds(events);
  let foundation: string | undefined;
  for (const event of events) {
    if (event.toothNumber !== toothNumber || superseded.has(String(event.id))) continue;
    if (event.supersessionType === "entered-in-error") continue;
    if (event.conditionCode && FOUNDATION_CODES.includes(event.conditionCode)) foundation = event.conditionCode;
  }
  return foundation;
}

/** Everything ever charted, oldest first — corrections and retractions included. */
export function history(patientId: string) {
  return loadEvents(patientId);
}

/** Which events replaced each event — worked out, never stored, since rows are never written twice. */
export async function supersededBy(
  patientId: string,
): Promise<Map<string, Array<{ id: string; type: string | null }>>> {
  const links = await prisma.odontogramEvent.findMany({
    where: { patientId, replacesEventId: { not: null } },
    select: { id: true, replacesEventId: true, supersessionType: true },
    orderBy: { id: "asc" },
  });

  const inverse = new Map<string, Array<{ id: string; type: string | null }>>();
  for (const link of links) {
    const key = String(link.replacesEventId);
    inverse.set(key, [...(inverse.get(key) ?? []), { id: String(link.id), type: link.supersessionType }]);
  }
  return inverse;
}

function loadEvents(patientId: string, asOf?: Date) {
  return prisma.odontogramEvent.findMany({
    where: { patientId, ...(asOf ? { observedAt: { lte: asOf } } : {}) },
    orderBy: [{ observedAt: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

/**
 * Every event that something else replaces. A chain — A replaced by B, B
 * replaced by C — drops both A and B, leaving C.
 */
function supersededIds(events: OdontogramEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const event of events) {
    if (event.replacesEventId != null) ids.add(String(event.replacesEventId));
  }
  return ids;
}

/** The surfaces an event names, or none at all when it describes the whole tooth. */
function surfacesOf(event: OdontogramEvent): string[] {
  if (!Array.isArray(event.surfaces)) return [];
  return event.surfaces.filter((s): s is string => typeof s === "string");
}
