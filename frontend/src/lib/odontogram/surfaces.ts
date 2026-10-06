/**
 * Which region of a tooth's diagram is which surface.
 *
 * This is the detail that is easy to get wrong and impossible to see wrong. The
 * chart draws every tooth as the same five-region box, but **what those regions
 * mean depends on where the tooth is in the mouth** — and the component that
 * stood here hard-coded `M = left, D = right, B = top, L = bottom` for all
 * thirty-two teeth.
 *
 * Two independent flips:
 *
 *  1. **Mesial always faces the midline.** On a chart drawn dentist's-view, the
 *     right-hand quadrants (1, 4, 5, 8) sit left of the midline, so their mesial
 *     is the *right* region. The left-hand quadrants (2, 3, 6, 7) are mirrored.
 *  2. **Buccal always faces the cheek.** For maxillary teeth, drawn with the
 *     crown below the root, that is the *top* region. For mandibular teeth the
 *     whole cell is flipped, so buccal is the *bottom*.
 *
 * Get either wrong and the chart records an MO restoration as a DO. Nothing
 * throws, nothing looks broken, and the tooth is painted on the wrong side of
 * the mouth in a clinical record.
 *
 * The centre region is **occlusal** on posteriors and **incisal** on anteriors —
 * molars and premolars grind, incisors and canines cut. The API's surface
 * vocabulary carries both (`O` and `I`), and the frontend previously dropped `I`
 * entirely, so an incisal finding rendered as nothing at all.
 */

/** Where a region sits in the drawn cell. Geometry, not anatomy. */
export type Region = 'top' | 'bottom' | 'left' | 'right' | 'centre'

/** What the API stores. `I` is incisal — the biting edge of an anterior tooth. */
export type Surface = 'M' | 'D' | 'B' | 'L' | 'O' | 'I'

const ALL_REGIONS: readonly Region[] = ['top', 'right', 'bottom', 'left', 'centre']

/** FDI quadrant: 1–4 permanent, 5–8 deciduous. */
export const quadrantOf = (fdi: number): number => Math.floor(fdi / 10)

/** Position 1–8 outward from the midline. */
export const positionOf = (fdi: number): number => fdi % 10

/** Quadrants 1, 2, 5, 6 are upper; 3, 4, 7, 8 are lower. */
export const isUpper = (fdi: number): boolean => [1, 2, 5, 6].includes(quadrantOf(fdi))

/** Quadrants 1, 4, 5, 8 are the patient's right. */
export const isPatientRight = (fdi: number): boolean => [1, 4, 5, 8].includes(quadrantOf(fdi))

/** Quadrants 5–8 are the deciduous dentition. */
export const isDeciduous = (fdi: number): boolean => quadrantOf(fdi) >= 5

/**
 * Anteriors are positions 1–3 — central incisor, lateral incisor, canine. They
 * have an incisal edge rather than an occlusal table, and it is drawn as a wide
 * shallow band rather than a square.
 */
export const isAnterior = (fdi: number): boolean => positionOf(fdi) <= 3

/** The centre region's surface: incisal for anteriors, occlusal for the rest. */
export const centreSurface = (fdi: number): Surface => (isAnterior(fdi) ? 'I' : 'O')

/**
 * Region → surface, for one tooth.
 *
 * Built per tooth rather than looked up in a table, because the two flips are
 * the whole content of the function and a table would hide them.
 */
export function surfacesByRegion(fdi: number): Record<Region, Surface> {
  // Mesial faces the midline. Right-hand quadrants sit left of it on the chart,
  // so their mesial is the right-hand region.
  const [left, right]: [Surface, Surface] = isPatientRight(fdi) ? ['D', 'M'] : ['M', 'D']

  // Buccal faces the cheek. The mandibular cell is drawn flipped, so its buccal
  // is at the bottom.
  const [top, bottom]: [Surface, Surface] = isUpper(fdi) ? ['B', 'L'] : ['L', 'B']

  return { top, bottom, left, right, centre: centreSurface(fdi) }
}

/** The inverse: surface → region, for hit-testing and for painting from data. */
export function regionsBySurface(fdi: number): Partial<Record<Surface, Region>> {
  const byRegion = surfacesByRegion(fdi)
  const out: Partial<Record<Surface, Region>> = {}
  for (const region of ALL_REGIONS) out[byRegion[region]] = region
  return out
}

/**
 * Every surface this tooth has, in **clinical order** — mesial, biting surface,
 * distal, buccal, lingual.
 *
 * Not the order the regions are drawn in. `MOD` is how a three-surface
 * restoration is written and said, and a canonical form that emitted `MDO`
 * would be correct data that no clinician would recognise. `MODBL` describes
 * full coverage, and reads in that order too.
 */
export const surfacesOf = (fdi: number): Surface[] => {
  const byRegion = surfacesByRegion(fdi)
  const mesial = isPatientRight(fdi) ? byRegion.right : byRegion.left
  const distal = isPatientRight(fdi) ? byRegion.left : byRegion.right

  return [mesial, byRegion.centre, distal, byRegion.top === 'B' ? 'B' : byRegion.bottom, byRegion.top === 'B' ? byRegion.bottom : byRegion.top]
}

/** Full names, for tooltips and screen readers. Palatal above, lingual below. */
export function surfaceName(fdi: number, surface: Surface): string {
  switch (surface) {
    case 'M': return 'Mesial'
    case 'D': return 'Distal'
    case 'B': return 'Buccal'
    case 'L': return isUpper(fdi) ? 'Palatal' : 'Lingual'
    case 'O': return 'Occlusal'
    case 'I': return 'Incisal'
  }
}

/**
 * Parse a typed surface code — `MOD`, `DO`, `B` — and repair what the tooth
 * cannot have.
 *
 * Borrowed from Eaglesoft, which does exactly this: type `DOBL` against an
 * upper anterior and it becomes `DIFL`, because an incisor has no occlusal
 * table. A fast typist charts MOD in three keystrokes and cannot produce an
 * anatomically impossible combination.
 *
 * Unknown letters are dropped rather than rejected: the caller is mid-keystroke
 * and a validation error on every partial word is unusable.
 */
export function parseSurfaceCode(fdi: number, code: string): Surface[] {
  const centre = centreSurface(fdi)
  const valid = new Set<Surface>(surfacesOf(fdi))
  const seen = new Set<Surface>()

  for (const raw of code.toUpperCase()) {
    // O and I are the same region under two names; snap to whichever this
    // tooth actually has rather than dropping the letter.
    const letter = raw === 'O' || raw === 'I' ? centre : (raw as Surface)
    // F for facial is B for buccal — the anterior clinician's word for it.
    const surface = (letter as string) === 'F' ? 'B' : letter

    if (valid.has(surface as Surface)) seen.add(surface as Surface)
  }

  // Presentation order, not typing order, so MOD and DOM render identically.
  return surfacesOf(fdi).filter((s) => seen.has(s))
}

/** Canonical code for a set of surfaces — the inverse of the parser. */
export const surfaceCode = (fdi: number, surfaces: Surface[]): string =>
  surfacesOf(fdi)
    .filter((s) => surfaces.includes(s))
    .join('')
