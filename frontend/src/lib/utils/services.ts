import type { AppointmentType } from "@/types/api";

// Appointment types double as the clinic's services, each with one price.

/** Services the Treatment sheet suggests: active, not block time, by name. */
export function pricedServices(types: AppointmentType[]): AppointmentType[] {
  return types.filter((t) => t.is_active && !t.is_block_time).sort((a, b) => a.name.localeCompare(b.name));
}

/** The price of the service a procedure names exactly (case and spaces aside), or null. */
export function priceFor(procedure: string, types: AppointmentType[]): number | null {
  const name = procedure.trim().toLowerCase();
  if (!name) return null;
  return pricedServices(types).find((t) => t.name.trim().toLowerCase() === name)?.price ?? null;
}
