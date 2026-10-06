import { describe, expect, it } from 'vitest'

import {
  centreSurface,
  isAnterior,
  isPatientRight,
  isUpper,
  parseSurfaceCode,
  quadrantOf,
  regionsBySurface,
  surfaceCode,
  surfaceName,
  surfacesByRegion,
} from './surfaces'

/**
 * The geometry, which is the part that fails silently.
 *
 * The component that stood here drew `M` on the left of every tooth and `B` on
 * the top of every tooth. Both are wrong for half the mouth, and neither throws:
 * the chart simply records an MO restoration as a DO, on the wrong side, in a
 * clinical record. These tests exist because nothing else can catch that.
 */

describe('mesial faces the midline', () => {
  /**
   * The chart is drawn dentist's-view, patient's right on the viewer's left. So
   * the right-hand quadrants sit *left* of the midline and their mesial — which
   * always points at the midline — is the right-hand region.
   */
  it.each([11, 18, 41, 48, 51, 81])('quadrant of tooth %i is a right quadrant', (fdi) => {
    expect(isPatientRight(fdi)).toBe(true)
    expect(surfacesByRegion(fdi).right).toBe('M')
    expect(surfacesByRegion(fdi).left).toBe('D')
  })

  it.each([21, 28, 31, 38, 61, 71])('tooth %i is a left quadrant and is mirrored', (fdi) => {
    expect(isPatientRight(fdi)).toBe(false)
    expect(surfacesByRegion(fdi).left).toBe('M')
    expect(surfacesByRegion(fdi).right).toBe('D')
  })

  /** The two central incisors are adjacent across the midline and mirror images. */
  it('mirrors the two teeth either side of the midline', () => {
    expect(surfacesByRegion(11).right).toBe('M')
    expect(surfacesByRegion(21).left).toBe('M')
  })
})

describe('buccal faces the cheek', () => {
  it.each([11, 18, 21, 28, 51, 65])('tooth %i is upper, so buccal is the top', (fdi) => {
    expect(isUpper(fdi)).toBe(true)
    expect(surfacesByRegion(fdi).top).toBe('B')
    expect(surfacesByRegion(fdi).bottom).toBe('L')
  })

  /**
   * The lower cell is drawn flipped — root pointing down, crown toward the
   * occlusal plane — so its buccal is at the bottom. This is the half of the
   * chart the previous component had upside down.
   */
  it.each([31, 38, 41, 48, 71, 85])('tooth %i is lower, so buccal is the bottom', (fdi) => {
    expect(isUpper(fdi)).toBe(false)
    expect(surfacesByRegion(fdi).bottom).toBe('B')
    expect(surfacesByRegion(fdi).top).toBe('L')
  })
})

describe('the centre region', () => {
  /** Molars and premolars grind; incisors and canines cut. */
  it.each([11, 12, 13, 21, 31, 43, 51, 73])('tooth %i is anterior, so its centre is incisal', (fdi) => {
    expect(isAnterior(fdi)).toBe(true)
    expect(centreSurface(fdi)).toBe('I')
    expect(surfacesByRegion(fdi).centre).toBe('I')
  })

  it.each([14, 16, 18, 24, 36, 48, 54, 75])('tooth %i is posterior, so its centre is occlusal', (fdi) => {
    expect(isAnterior(fdi)).toBe(false)
    expect(centreSurface(fdi)).toBe('O')
  })
})

describe('every tooth has exactly five distinct surfaces', () => {
  const everyTooth = [
    ...[1, 2, 3, 4].flatMap((q) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => q * 10 + p)),
    ...[5, 6, 7, 8].flatMap((q) => [1, 2, 3, 4, 5].map((p) => q * 10 + p)),
  ]

  it('covers all 52 teeth', () => {
    expect(everyTooth).toHaveLength(52)
  })

  it.each(everyTooth)('tooth %i maps five regions to five different surfaces', (fdi) => {
    const byRegion = surfacesByRegion(fdi)
    const surfaces = Object.values(byRegion)

    expect(surfaces).toHaveLength(5)
    expect(new Set(surfaces).size).toBe(5)

    // And the inverse is a genuine inverse — otherwise painting from data would
    // land on a different region than clicking did.
    const bySurface = regionsBySurface(fdi)
    for (const [region, surface] of Object.entries(byRegion)) {
      expect(bySurface[surface]).toBe(region)
    }
  })
})

describe('naming', () => {
  /** The same surface has two names depending on the jaw it is in. */
  it('calls the tongue side palatal above and lingual below', () => {
    expect(surfaceName(16, 'L')).toBe('Palatal')
    expect(surfaceName(46, 'L')).toBe('Lingual')
  })

  it('names the biting surface for what the tooth does', () => {
    expect(surfaceName(16, 'O')).toBe('Occlusal')
    expect(surfaceName(11, 'I')).toBe('Incisal')
  })
})

describe('typed surface codes', () => {
  it('parses MOD on a molar', () => {
    expect(parseSurfaceCode(16, 'MOD')).toEqual(['M', 'O', 'D'])
  })

  it('returns surfaces in presentation order, so MOD and DOM are the same line', () => {
    expect(parseSurfaceCode(16, 'DOM')).toEqual(parseSurfaceCode(16, 'MOD'))
  })

  /**
   * Eaglesoft's autocorrect, and worth copying: type an occlusal code against an
   * incisor and it becomes incisal, because an incisor has no occlusal table.
   * The alternative is a validation error on an anatomically impossible
   * combination the clinician cannot see is impossible.
   */
  it('snaps occlusal to incisal on an anterior tooth', () => {
    expect(parseSurfaceCode(11, 'MOD')).toEqual(['M', 'I', 'D'])
  })

  it('snaps incisal to occlusal on a posterior tooth', () => {
    expect(parseSurfaceCode(16, 'MID')).toEqual(['M', 'O', 'D'])
  })

  it('reads F for facial as B for buccal', () => {
    expect(parseSurfaceCode(11, 'F')).toEqual(['B'])
  })

  it('ignores letters that are not surfaces rather than refusing the whole code', () => {
    // The caller is mid-keystroke; an error on every partial word is unusable.
    expect(parseSurfaceCode(16, 'MZOQ')).toEqual(['M', 'O'])
    expect(parseSurfaceCode(16, '')).toEqual([])
  })

  it('is case-insensitive and drops duplicates', () => {
    expect(parseSurfaceCode(16, 'mmOo')).toEqual(['M', 'O'])
  })

  /**
   * The canonical form is clinical order, not the order it was typed. `MOD` is
   * how a three-surface restoration is written and said; a canonical `MDO` would
   * be correct data that no clinician would recognise.
   */
  it('canonicalises to clinical order, whatever order it was typed in', () => {
    expect(surfaceCode(36, parseSurfaceCode(36, 'BMOD'))).toBe('MODB')
    expect(surfaceCode(36, parseSurfaceCode(36, 'DBOM'))).toBe('MODB')
  })

  it('round-trips through the canonical code', () => {
    const surfaces = parseSurfaceCode(36, 'BMOD')
    expect(parseSurfaceCode(36, surfaceCode(36, surfaces))).toEqual(surfaces)
  })

  it('spells full coverage MODBL, in that order', () => {
    expect(surfaceCode(16, parseSurfaceCode(16, 'LBDOM'))).toBe('MODBL')
    expect(surfaceCode(11, parseSurfaceCode(11, 'LBDIM'))).toBe('MIDBL')
  })
})

describe('quadrants', () => {
  it.each([
    [11, 1], [28, 2], [31, 3], [48, 4], [55, 5], [61, 6], [75, 7], [85, 8],
  ])('reads the quadrant of %i as %i', (fdi, q) => {
    expect(quadrantOf(fdi)).toBe(q)
  })
})
