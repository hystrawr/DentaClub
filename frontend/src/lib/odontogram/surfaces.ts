/**
 * Which region of a tooth's diagram is which surface. Every tooth is drawn as
 * the same five-region box, but the meaning of each region depends on where
 * the tooth is in the mouth:
 *
 *  1. **Mesial faces the midline.** The patient's right-hand quadrants (1, 4,
 *     5, 8) sit left of it on the chart, so their mesial is the right region.
 *  2. **Buccal faces the cheek:** the top region for upper teeth, the bottom
 *     for lower teeth (whose cell is drawn flipped).
 *
 * The centre is occlusal on back teeth and incisal on front teeth.
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

/** Region → surface, for one tooth. */
export function surfacesByRegion(fdi: number): Record<Region, Surface> {
  const [left, right]: [Surface, Surface] = isPatientRight(fdi) ? ['D', 'M'] : ['M', 'D']

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

/** Every surface this tooth has, in clinical order (M, O/I, D, B, L), so codes read as `MOD`. */
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
 * Parse a typed surface code (`MOD`, `DO`, `B`), fixing what the tooth cannot
 * have: an `O` on a front tooth becomes `I`. Unknown letters are ignored, since
 * the user is still typing.
 */
export function parseSurfaceCode(fdi: number, code: string): Surface[] {
  const centre = centreSurface(fdi)
  const valid = new Set<Surface>(surfacesOf(fdi))
  const seen = new Set<Surface>()

  for (const raw of code.toUpperCase()) {
    const letter = raw === 'O' || raw === 'I' ? centre : (raw as Surface)
    // F for facial is B for buccal — the anterior clinician's word for it.
    const surface = (letter as string) === 'F' ? 'B' : letter

    if (valid.has(surface as Surface)) seen.add(surface as Surface)
  }

  return surfacesOf(fdi).filter((s) => seen.has(s))
}

/** Canonical code for a set of surfaces — the inverse of the parser. */
export const surfaceCode = (fdi: number, surfaces: Surface[]): string =>
  surfacesOf(fdi)
    .filter((s) => surfaces.includes(s))
    .join('')
