/**
 * The clinic's lunch break, on the Manila clock. Nothing may be booked over it.
 * Kept in step with `LUNCH_START`/`LUNCH_END` in the backend's
 * services/scheduling/appointments.ts, which refuses it too.
 */
export const LUNCH_START = '12:00'
export const LUNCH_END = '13:00'

export const LUNCH_MESSAGE = '12–1 PM is the lunch break.'

/** Whether `HH:mm` start to end on one day overlaps the lunch break. Back-to-back (ends 12:00, starts 1:00) is fine. */
export const overlapsLunch = (start: string, end: string): boolean => start < LUNCH_END && end > LUNCH_START
