import type { OdontogramEvent } from '@/lib/api/odontogram'

/**
 * What may still be charted on a tooth, given what the tooth *is* (its
 * foundation: its latest missing, extraction, implant, pontic or denture
 * finding, so a crowned implant is still an implant).
 *
 *  - missing or extracted: only an implant, a pontic or a removable denture
 *  - implant: only a crown or an abutment
 *  - removable denture or pontic: nothing more
 *  - natural tooth: anything
 *
 * Corrections are never blocked; a wrong finding is fixed with "Mark entered in
 * error". The API enforces the same rules (backend `services/chart.ts`).
 */

/** Whole-tooth findings that mean the natural tooth is gone. */
export const ABSENT_CODES = ['missing', 'missing_other', 'extraction', 'extraction_other'] as const

/** Findings that decide what the tooth is: gone, or replaced. */
const FOUNDATION_CODES: readonly string[] = [...ABSENT_CODES, 'implant', 'pontic', 'removable_denture']

/**
 * The tooth's foundation from its history (newest first), or undefined for a
 * natural tooth. Corrected and withdrawn entries are skipped.
 */
export function toothFoundation(historyNewestFirst: OdontogramEvent[]): string | undefined {
  return historyNewestFirst.find(
    (e) => e.status === 'final' && e.condition_code != null && FOUNDATION_CODES.includes(e.condition_code),
  )?.condition_code ?? undefined
}

/** The findings allowed on a tooth with this foundation, or null when anything may be charted. */
export function allowedFindings(foundation: string | null | undefined): string[] | null {
  if (!foundation) return null
  if ((ABSENT_CODES as readonly string[]).includes(foundation)) return ['implant', 'pontic', 'removable_denture']
  if (foundation === 'implant') return ['crown', 'abutment']
  if (foundation === 'removable_denture' || foundation === 'pontic') return []
  return null
}

export const isAllowedOn = (foundation: string | null | undefined, code: string): boolean => {
  const allowed = allowedFindings(foundation)
  return allowed === null || allowed.includes(code)
}

/** One line for the chart panel saying why its options are limited, or null when they are not. */
export function toothRuleNote(fdi: number, foundation: string | null | undefined): string | null {
  if (allowedFindings(foundation) === null) return null
  if (foundation === 'removable_denture') return `Tooth ${fdi} has a removable denture, so nothing more can be charted on it.`
  if (foundation === 'pontic') return `Tooth ${fdi} is a pontic (a bridge's false tooth), so nothing more can be charted on it.`
  if (foundation === 'implant') return `Tooth ${fdi} has an implant, so only a jacket crown or an abutment can be charted on it.`
  return `Tooth ${fdi} is missing, so only an implant, a pontic or a removable denture can be charted on it.`
}
