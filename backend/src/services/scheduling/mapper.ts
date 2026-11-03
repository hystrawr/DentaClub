import type {
  Appointment,
  AppointmentType,
  Location,
  Operatory,
  Patient,
  ProviderAvailability,
  ProviderProfile,
} from "../../generated/prisma/client.js";
import { isoOffset, isoUtc, timeString } from "../../lib/dates.js";

// Scheduling response shapes, ported from DentalOS
// apps/api/src/scheduling/scheduling.mapper.ts (tenant_id / deleted_at removed).

type AppointmentWithRelations = Appointment & {
  patient?: Patient | null;
  provider?: ProviderProfile | null;
  appointmentType?: AppointmentType | null;
  operatory?: Operatory | null;
};

/**
 * `AppointmentResource`.
 *
 * `withRelations: false` omits the four relation keys entirely — **absent, not
 * null**. The 409 body hands back the conflicting appointment that way.
 */
export function appointmentResource(a: AppointmentWithRelations, withRelations = true) {
  const base = {
    id: a.id,
    status: a.status,
    scheduled_start: isoOffset(a.scheduledStart),
    scheduled_end: isoOffset(a.scheduledEnd),
    actual_start: isoOffset(a.actualStart),
    actual_end: isoOffset(a.actualEnd),
    notes: a.notes,
    cancellation_reason: a.cancellationReason,
    created_at: isoOffset(a.createdAt),
  };

  if (!withRelations) return base;

  // A *null* relation — a block-time slot has no patient — serialises as null
  // rather than throwing on the way through.
  return {
    ...base,
    patient: a.patient
      ? { id: a.patient.id, full_name: `${a.patient.firstName} ${a.patient.lastName}`.trim() }
      : null,
    provider: a.provider ? { id: a.provider.id, name: a.provider.name, color_hex: a.provider.colorHex } : null,
    appointment_type: a.appointmentType
      ? {
          id: a.appointmentType.id,
          name: a.appointmentType.name,
          duration_minutes: a.appointmentType.durationMinutes,
          color_hex: a.appointmentType.colorHex,
        }
      : null,
    operatory: a.operatory ? { id: a.operatory.id, name: a.operatory.name, color: a.operatory.color } : null,
  };
}

/** Read a dentist with this, so `providerProfileResource` has the specializations. */
export const withSpecializations = { specializations: { select: { name: true }, orderBy: { name: "asc" } } } as const;

/** `ProviderProfileResource`. */
export function providerProfileResource(p: ProviderProfile & { specializations: Array<{ name: string }> }) {
  return {
    id: p.id,
    name: p.name,
    prc_number: p.prcNumber,
    specializations: p.specializations.map((s) => s.name),
    color_hex: p.colorHex,
    is_active: p.isActive,
  };
}

export function appointmentTypeModel(t: AppointmentType) {
  return {
    id: t.id,
    name: t.name,
    duration_minutes: t.durationMinutes,
    color_hex: t.colorHex,
    is_block_time: t.isBlockTime,
    price: t.price === null ? null : Number(t.price),
    is_active: t.isActive,
    created_at: isoUtc(t.createdAt),
    updated_at: isoUtc(t.updatedAt),
  };
}

export function providerAvailabilityModel(a: ProviderAvailability) {
  return {
    id: a.id,
    provider_profile_id: a.providerProfileId,
    location_id: a.locationId,
    day_of_week: a.dayOfWeek,
    start_time: timeString(a.startTime),
    end_time: timeString(a.endTime),
    created_at: isoUtc(a.createdAt),
    updated_at: isoUtc(a.updatedAt),
  };
}

export function locationResource(l: Location) {
  return {
    id: l.id,
    name: l.name,
    address: l.address,
    city: l.city,
    phone: l.phone,
    is_active: l.isActive,
  };
}

/** `location_name` is flattened in — both screens that read this want one line of text. */
export function operatoryResource(o: Operatory & { location?: Location | null }) {
  return {
    id: o.id,
    location_id: o.locationId,
    location_name: o.location?.name ?? null,
    name: o.name,
    color: o.color,
    sort_order: o.sortOrder,
    is_active: o.isActive,
  };
}
