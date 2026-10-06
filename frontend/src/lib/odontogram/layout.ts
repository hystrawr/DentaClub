import { isDeciduous, positionOf, quadrantOf } from './surfaces'

/**
 * Where each tooth sits on the chart.
 *
 * ## Dentist's view, and the lower arch was mirrored
 *
 * The convention is universal and the PDA's printed chart states it in words:
 * `RIGHT` is at the left edge of every row. The chart is drawn as the clinician
 * sees the patient, so **the patient's right is the viewer's left**.
 *
 * The layout that stood here got the upper arch right and the lower arch
 * backwards: it ran quadrant 3 (lower *left*) beneath quadrant 1 (upper
 * *right*). Every column paired a tooth with one on the opposite side of the
 * mouth — tooth 11 sat above tooth 31 rather than 41. Read-only that is a
 * misreading; clickable it charts the wrong side.
 *
 * Correct is quadrant 1 above quadrant 4, and quadrant 2 above quadrant 3:
 *
 *     18 17 16 15 14 13 12 11 │ 21 22 23 24 25 26 27 28
 *     ─────────────────────── ┼ ───────────────────────
 *     48 47 46 45 44 43 42 41 │ 31 32 33 34 35 36 37 38
 *
 * ## Deciduous rows sit outside, not inside
 *
 * The PDA chart prints the temporary rows *outside* the permanent ones — upper
 * temporary above upper permanent, lower temporary below lower permanent. The
 * WHO/Indonesian layout nests them inside instead. Following the PDA form means
 * a Filipino clinician reads the chart without relearning it.
 */

/** Left-to-right, as drawn. Quadrant 1 descending, then quadrant 2 ascending. */
export const UPPER_PERMANENT = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]

/** Quadrant 4 descending, then quadrant 3 ascending — so 41 sits under 11. */
export const LOWER_PERMANENT = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

/** Ten teeth, centred under the sixteen above them. */
export const UPPER_DECIDUOUS = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
export const LOWER_DECIDUOUS = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]

export type ArchRow = {
  key: 'upper-deciduous' | 'upper-permanent' | 'lower-permanent' | 'lower-deciduous'
  label: string
  teeth: number[]
  /** Deciduous rows are inset so their midline lines up with the row above. */
  inset: number
}

const ROWS: ArchRow[] = [
  { key: 'upper-deciduous', label: 'Upper temporary', teeth: UPPER_DECIDUOUS, inset: 3 },
  { key: 'upper-permanent', label: 'Upper permanent', teeth: UPPER_PERMANENT, inset: 0 },
  { key: 'lower-permanent', label: 'Lower permanent', teeth: LOWER_PERMANENT, inset: 0 },
  { key: 'lower-deciduous', label: 'Lower temporary', teeth: LOWER_DECIDUOUS, inset: 3 },
]

export type Dentition = 'permanent' | 'mixed' | 'deciduous'

/**
 * Which rows to draw.
 *
 * A dentition is a display choice, not a fact about the patient — a nine-year-old
 * has both, and a chart that hid one would make half their mouth uncharatable.
 * `mixed` therefore shows all four rows, and the caller picks the default from
 * the patient's age.
 */
export function rowsFor(dentition: Dentition): ArchRow[] {
  if (dentition === 'permanent') return ROWS.filter((r) => !r.key.includes('deciduous'))
  if (dentition === 'deciduous') return ROWS.filter((r) => r.key.includes('deciduous'))
  return ROWS
}

/**
 * The dentition to open on, from age.
 *
 * Deciduous teeth start exfoliating around six and the last of them is usually
 * gone by thirteen. Both products that do this (Dentrix Ascend, Dentally) derive
 * it from age on chart creation and let the clinician override — the age is a
 * good guess and never an assertion.
 */
export function dentitionForAge(age: number | null | undefined): Dentition {
  if (age == null) return 'permanent'
  if (age < 6) return 'deciduous'
  if (age <= 13) return 'mixed'
  return 'permanent'
}

/** Whether a row belongs to the upper jaw — decides which way the root points. */
export const rowIsUpper = (row: ArchRow): boolean => row.key.startsWith('upper')

/**
 * A tooth's own column index within its row, and whether it sits left of the
 * midline. The midline gap is drawn between the two halves of each row.
 */
export function columnOf(row: ArchRow, fdi: number): { index: number; leftOfMidline: boolean } {
  const index = row.teeth.indexOf(fdi)
  return { index, leftOfMidline: index < row.teeth.length / 2 }
}

/** `UR` / `UL` / `LR` / `LL`, for the corner labels. */
export function quadrantLabel(fdi: number): string {
  const q = quadrantOf(fdi)
  if (q === 1 || q === 5) return 'UR'
  if (q === 2 || q === 6) return 'UL'
  if (q === 3 || q === 7) return 'LL'
  return 'LR'
}

/**
 * The tooth's clinical name — "Upper right first molar".
 *
 * Spoken FDI is digit-by-digit ("one-six", never "sixteen"), but a screen reader
 * needs the name, and so does anyone hovering a tooth they cannot place.
 */
const PERMANENT_NAMES = [
  'central incisor', 'lateral incisor', 'canine', 'first premolar',
  'second premolar', 'first molar', 'second molar', 'third molar',
]

const DECIDUOUS_NAMES = [
  'central incisor', 'lateral incisor', 'canine', 'first molar', 'second molar',
]

export function toothName(fdi: number): string {
  const q = quadrantOf(fdi)
  const vertical = q === 1 || q === 2 || q === 5 || q === 6 ? 'Upper' : 'Lower'
  const side = [1, 4, 5, 8].includes(q) ? 'right' : 'left'
  const names = isDeciduous(fdi) ? DECIDUOUS_NAMES : PERMANENT_NAMES
  const name = names[positionOf(fdi) - 1] ?? 'tooth'

  return `${vertical} ${side} ${isDeciduous(fdi) ? 'primary ' : ''}${name}`
}

/**
 * FDI → Universal (1–32 permanent, A–T deciduous).
 *
 * Display only; FDI is what is stored. Offered because a patient with US dental
 * records — an OFW returning home — arrives with a chart numbered the other way,
 * and reading it against an FDI chart is where transcription errors come from.
 */
export function toUniversal(fdi: number): string {
  const q = quadrantOf(fdi)
  const p = positionOf(fdi)

  // Universal runs clockwise from the upper-right third molar: 1–16 across the
  // upper arch, then 17–32 back across the lower. So the *lower left* is 17–24
  // and the lower right is 25–32 — the opposite way round from the upper arch,
  // which is exactly the trap. Verified endpoint by endpoint in the spec.
  if (q === 1) return String(9 - p)   // 18→1  … 11→8
  if (q === 2) return String(8 + p)   // 21→9  … 28→16
  if (q === 3) return String(25 - p)  // 38→17 … 31→24
  if (q === 4) return String(24 + p)  // 41→25 … 48→32

  // Deciduous A–T, clockwise the same way: A–E upper right, F–J upper left,
  // K–O lower left, P–T lower right.
  const letters = 'ABCDEFGHIJKLMNOPQRST'
  if (q === 5) return letters[5 - p]  // 55→A … 51→E
  if (q === 6) return letters[4 + p]  // 61→F … 65→J
  if (q === 7) return letters[15 - p] // 75→K … 71→O
  return letters[14 + p]              // 81→P … 85→T
}
