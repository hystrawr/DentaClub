import type { OdontogramEvent } from "../generated/prisma/client.js";
import { isoOffset } from "../lib/dates.js";

/**
 * FHIR `observation-status` words, so the frontend does a lookup rather than
 * recomputing a judgement. A correction is `final` until something corrects it.
 */
function statusOf(supersededBy: Array<{ type: string | null }>): string {
  if (supersededBy.length === 0) return "final";
  if (supersededBy.some((s) => s.type === "entered-in-error")) return "entered-in-error";
  if (supersededBy.some((s) => s.type === "correction")) return "corrected";
  return "amended";
}

/** The API shape of one dental chart event. */
export function odontogramEventResource(
  e: OdontogramEvent,
  supersededBy: Array<{ id: string; type: string | null }> = [],
) {
  return {
    // BigInt cannot go through JSON.stringify, so ids become plain numbers.
    id: Number(e.id),
    tooth_number: e.toothNumber,
    event_type: e.eventType,
    surfaces: e.surfaces,
    condition_code: e.conditionCode,
    notes: e.notes,
    created_at: isoOffset(e.createdAt),
    observed_at: isoOffset(e.observedAt),
    replaces_event_id: e.replacesEventId == null ? null : Number(e.replacesEventId),
    supersession_type: e.supersessionType,
    supersession_reason: e.supersessionReason,
    // The events that replaced this one; empty while it still stands.
    superseded_by_event_ids: supersededBy.map((s) => Number(s.id)),
    status: statusOf(supersededBy),
  };
}
