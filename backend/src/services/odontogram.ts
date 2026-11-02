import type { OdontogramEvent } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { isValidFdi } from "../lib/chart.js";
import { notFound, ruleViolation } from "../lib/http-error.js";
import { assertActivePatient } from "../lib/patients.js";

/**
 * The odontogram — the tooth chart — is **append-only**. (Ported from DentalOS.)
 *
 * Nothing here updates or deletes a row. A mistake is corrected by writing a new
 * event that names the one it supersedes, so the chart's history is the record of
 * what was believed when, not just what is believed now. That matters clinically
 * (a finding later corrected still explains why a treatment was planned) and
 * legally: an amended record must identify the amendment as such and retain all
 * original content without deletion.
 *
 * `eventType` says *what is asserted*; `supersessionType` says *how this entry
 * relates to the record*. A correction is an ordinary condition/procedure event
 * that happens to point at what it replaces. The one entry that asserts nothing
 * is `entered-in-error` — a tombstone for an entry that should never have existed.
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
      // Valid time. Defaults to now for live charting, and is set explicitly
      // when charting a past visit — which is the case the fold depends on.
      observedAt: dto.observed_at ? new Date(dto.observed_at) : new Date(),
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
 * The chart as it stands, at surface resolution: `tooth → surface → event`.
 * Events are applied in the order they were true (`observedAt`, then
 * `createdAt`, then `id`), so a back-dated correction cannot clobber a later
 * finding. This is what the chart component paints — a tooth can carry caries on the mesial and a
 * restoration on the occlusal at the same time.
 *
 * The `*` key is the whole tooth. A whole-tooth event (missing, unerupted,
 * implant, a full crown) clears the surfaces beneath it: a tooth that is not
 * there cannot have a filling in it.
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
      // Whole-tooth. Everything charted on its surfaces described a tooth in a
      // state this event has just replaced.
      state[event.toothNumber] = { "*": event };
      continue;
    }

    // A surface finding on a tooth previously charted whole is a contradiction
    // the clinician has just resolved — drop the whole-tooth entry.
    delete tooth["*"];
    for (const surface of surfaces) tooth[surface] = event;
  }

  return state;
}

/** Everything ever charted, oldest first — corrections and retractions included. */
export function history(patientId: string) {
  return loadEvents(patientId);
}

/**
 * The inverse of `replacesEventId`, computed rather than stored. Storing a
 * back-pointer would mean writing to the superseded row, which is still
 * writing to an immutable row.
 */
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
