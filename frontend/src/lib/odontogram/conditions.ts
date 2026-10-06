/**
 * What can be charted, and how it is drawn.
 *
 * ## The vocabulary is the PDA's
 *
 * These codes are the legend printed on the Philippine Dental Association's
 * Dental Chart — the form every PH clinic has filled in by hand, grouped exactly
 * as the form groups it. A clinician who knows the paper chart can read this one
 * without being taught it, and the two-letter code doubles as the label that
 * keeps the chart legible without colour.
 *
 * ## Two axes, and that is the whole design
 *
 * **Hue says what it is. Fill treatment says what its status is.** Eaglesoft,
 * axiUm and Open Dental each arrived at this separately, and the reason is that
 * hue runs out: past about six categories, colours start colliding and the label
 * is doing the work anyway. Encoding status in hue as well would need thirty
 * distinguishable colours for six conditions and five states.
 *
 * So a planned composite and an existing composite are the *same* colour, and
 * differ by a dashed outline and reduced fill. Three things follow:
 *
 *  - It survives greyscale printing, which the PDA form is.
 *  - It survives colour-blindness, since status never depends on hue.
 *  - Presenting a treatment plan animates cleanly — accepting a plan turns
 *    dashed into solid, and the tooth does not change colour under the patient.
 *
 * The traditional axis is preserved where it matters: **red is what needs
 * doing, blue is what has been done**, which is the convention every dental
 * assisting textbook teaches and one of the more colour-blind-tolerant pairs in
 * medicine.
 */

export type ConditionGroup = 'condition' | 'restoration' | 'surgery'

/** Where the finding lives — the whole tooth, or named surfaces of it. */
type ConditionScope = 'tooth' | 'surface'

export interface ConditionDef {
  /** What goes in `condition_code`. */
  code: string
  /** The PDA legend's abbreviation, drawn inside the surface. */
  short: string
  label: string
  group: ConditionGroup
  scope: ConditionScope
  /** Which hue token paints it. */
  tone: ConditionTone
  /** Fill pattern, for monochrome legibility. See `patterns` in the chart defs. */
  pattern?: 'solid' | 'outline' | 'hatch' | 'letter'
  hint?: string
}

type ConditionTone =
  | 'caries' | 'metal' | 'toothColoured' | 'ceramic' | 'endo' | 'implant' | 'missing' | 'watch'

/**
 * The catalogue.
 *
 * `code` values that already exist in the database — `caries`, `restoration`,
 * `crown`, `watch`, `missing` — keep their spelling. They are in the frozen
 * fixtures and in every seeded tenant, and renaming them would orphan every
 * finding ever charted.
 */
export const CONDITIONS: readonly ConditionDef[] = [
  // ── Condition ───────────────────────────────────────────────────────────
  {
    code: 'caries', short: 'D', label: 'Decayed', group: 'condition', scope: 'surface',
    tone: 'caries', pattern: 'solid',
    hint: 'Caries indicated for filling. Red is work outstanding.',
  },
  {
    code: 'watch', short: 'W', label: 'Watch', group: 'condition', scope: 'surface',
    tone: 'watch', pattern: 'outline',
    hint: 'Not treated today; re-examine at recall.',
  },
  {
    code: 'missing', short: 'M', label: 'Missing', group: 'condition', scope: 'tooth',
    tone: 'missing',
    hint: 'Missing due to caries. Charted on the whole tooth.',
  },
  {
    code: 'missing_other', short: 'MO', label: 'Missing (other cause)', group: 'condition', scope: 'tooth',
    tone: 'missing',
  },
  {
    code: 'impacted', short: 'Im', label: 'Impacted', group: 'condition', scope: 'tooth',
    tone: 'missing',
  },
  {
    code: 'unerupted', short: 'Un', label: 'Unerupted', group: 'condition', scope: 'tooth',
    tone: 'missing',
  },
  {
    code: 'root_fragment', short: 'Rf', label: 'Root fragment', group: 'condition', scope: 'tooth',
    tone: 'missing',
  },
  {
    code: 'supernumerary', short: 'Sp', label: 'Supernumerary', group: 'condition', scope: 'tooth',
    tone: 'watch',
  },

  // ── Restorations and prosthetics ────────────────────────────────────────
  {
    code: 'amalgam', short: 'Am', label: 'Amalgam filling', group: 'restoration', scope: 'surface',
    tone: 'metal', pattern: 'solid',
    hint: 'Metal is drawn dark and filled solid.',
  },
  {
    code: 'restoration', short: 'Co', label: 'Composite filling', group: 'restoration', scope: 'surface',
    tone: 'toothColoured', pattern: 'outline',
    hint: 'Tooth-coloured, so drawn outlined rather than filled.',
  },
  {
    code: 'inlay', short: 'In', label: 'Inlay', group: 'restoration', scope: 'surface',
    tone: 'metal', pattern: 'hatch',
  },
  {
    code: 'sealant', short: 'S', label: 'Sealant', group: 'restoration', scope: 'surface',
    tone: 'endo', pattern: 'letter',
    hint: 'Drawn as an S on the biting surface, as on the paper chart.',
  },
  {
    code: 'crown', short: 'JC', label: 'Jacket crown', group: 'restoration', scope: 'tooth',
    tone: 'ceramic', pattern: 'solid',
  },
  {
    code: 'root_canal', short: 'RCT', label: 'Root canal', group: 'restoration', scope: 'tooth',
    tone: 'endo',
    hint: 'Drawn down the root, not on a surface.',
  },
  {
    code: 'implant', short: 'Imp', label: 'Implant', group: 'restoration', scope: 'tooth',
    tone: 'implant',
  },
  {
    code: 'pontic', short: 'P', label: 'Pontic', group: 'restoration', scope: 'tooth',
    tone: 'implant',
  },
  {
    code: 'abutment', short: 'Ab', label: 'Abutment', group: 'restoration', scope: 'tooth',
    tone: 'implant',
  },
  {
    code: 'removable_denture', short: 'Rm', label: 'Removable denture', group: 'restoration', scope: 'tooth',
    tone: 'ceramic',
  },

  // ── Surgery ─────────────────────────────────────────────────────────────
  {
    code: 'extraction', short: 'X', label: 'Extraction (caries)', group: 'surgery', scope: 'tooth',
    tone: 'missing',
  },
  {
    code: 'extraction_other', short: 'XO', label: 'Extraction (other cause)', group: 'surgery', scope: 'tooth',
    tone: 'missing',
  },
]

const BY_CODE = new Map(CONDITIONS.map((c) => [c.code, c]))

export const conditionFor = (code: string | null | undefined): ConditionDef | undefined =>
  code ? BY_CODE.get(code) : undefined

export const conditionsInGroup = (group: ConditionGroup): ConditionDef[] =>
  CONDITIONS.filter((c) => c.group === group)

export const GROUP_LABELS: Record<ConditionGroup, string> = {
  condition: 'Condition',
  restoration: 'Restorations & prosthetics',
  surgery: 'Surgery',
}

/**
 * Whether a finding covers the whole tooth.
 *
 * The projection depends on this agreeing with the server: a whole-tooth event
 * sends no surfaces, and the API's fold treats a surface-less event as covering
 * the tooth and clears its surfaces. A tooth that is not there cannot have a
 * filling in it.
 */
export const isWholeTooth = (code: string | null | undefined): boolean =>
  conditionFor(code)?.scope === 'tooth'

/* ─── Status, the second axis ────────────────────────────────────────────── */

/**
 * `planned` and `existing` are the axis every dental chart has. The rest come
 * from the record rather than the clinician: `retracted` is a withdrawn finding
 * (never painted, only listed), and `superseded` is one a correction replaced.
 */
export type ChartStatus = 'existing' | 'planned' | 'completed' | 'retracted' | 'superseded'

export interface StatusStyle {
  /** Fill opacity applied to the condition's hue. */
  fill: number
  strokeWidth: number
  dashed: boolean
  label: string
}

export const STATUS_STYLES: Record<ChartStatus, StatusStyle> = {
  existing:   { fill: 1,    strokeWidth: 1,   dashed: false, label: 'Existing' },
  completed:  { fill: 1,    strokeWidth: 1.8, dashed: false, label: 'Completed today' },
  // Deliberately the same hue as `existing`, so accepting a plan does not change
  // the tooth's colour under the patient — only its outline resolves.
  planned:    { fill: 0.18, strokeWidth: 1.5, dashed: true,  label: 'Planned' },
  superseded: { fill: 0.1,  strokeWidth: 1,   dashed: true,  label: 'Corrected' },
  retracted:  { fill: 0,    strokeWidth: 1,   dashed: true,  label: 'Entered in error' },
}

/** The API's FHIR-flavoured `status` string → what the chart draws. */
export function chartStatusFor(apiStatus: string | null | undefined, eventType?: string): ChartStatus {
  if (apiStatus === 'entered-in-error') return 'retracted'
  if (apiStatus === 'corrected' || apiStatus === 'amended') return 'superseded'
  return eventType === 'procedure' || eventType === 'treatment' ? 'completed' : 'existing'
}
