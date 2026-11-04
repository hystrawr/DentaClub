import { describe, expect, it } from 'vitest'

import {
  LOWER_DECIDUOUS,
  LOWER_PERMANENT,
  UPPER_DECIDUOUS,
  UPPER_PERMANENT,
  dentitionForAge,
  quadrantLabel,
  rowsFor,
  toUniversal,
  toothName,
} from './layout'
import { isPatientRight, isUpper } from './surfaces'

/**
 * The arch layout. Each column must pair teeth from the same side of the mouth
 * (11 above 41, not 31), or a tap charts the wrong side.
 */

describe('the arches line up', () => {
  it('draws sixteen teeth per permanent arch, ten per deciduous', () => {
    expect(UPPER_PERMANENT).toHaveLength(16)
    expect(LOWER_PERMANENT).toHaveLength(16)
    expect(UPPER_DECIDUOUS).toHaveLength(10)
    expect(LOWER_DECIDUOUS).toHaveLength(10)
  })

  /** The bug, stated as an assertion: every column is one side of the mouth. */
  it('puts the same side of the mouth in the same column, in both arches', () => {
    UPPER_PERMANENT.forEach((upper, i) => {
      const lower = LOWER_PERMANENT[i]
      expect(isPatientRight(upper)).toBe(isPatientRight(lower))
    })
  })

  it('does the same for the deciduous rows', () => {
    UPPER_DECIDUOUS.forEach((upper, i) => {
      expect(isPatientRight(upper)).toBe(isPatientRight(LOWER_DECIDUOUS[i]))
    })
  })

  /** Dentist's view: the patient's right is the viewer's left. */
  it('starts every row on the patient’s right', () => {
    for (const row of [UPPER_PERMANENT, LOWER_PERMANENT, UPPER_DECIDUOUS, LOWER_DECIDUOUS]) {
      expect(isPatientRight(row[0])).toBe(true)
      expect(isPatientRight(row[row.length - 1])).toBe(false)
    }
  })

  it('puts the central incisors adjacent across the midline', () => {
    expect(UPPER_PERMANENT.slice(7, 9)).toEqual([11, 21])
    expect(LOWER_PERMANENT.slice(7, 9)).toEqual([41, 31])
  })

  it('aligns 11 over 41 and 21 over 31', () => {
    expect(LOWER_PERMANENT[UPPER_PERMANENT.indexOf(11)]).toBe(41)
    expect(LOWER_PERMANENT[UPPER_PERMANENT.indexOf(21)]).toBe(31)
  })

  it('counts outward from the midline in both directions', () => {
    // Third molars at the outer ends, central incisors in the middle.
    expect(UPPER_PERMANENT[0]).toBe(18)
    expect(UPPER_PERMANENT[15]).toBe(28)
    expect(LOWER_PERMANENT[0]).toBe(48)
    expect(LOWER_PERMANENT[15]).toBe(38)
  })

  it('keeps each arch in its own jaw', () => {
    for (const fdi of [...UPPER_PERMANENT, ...UPPER_DECIDUOUS]) expect(isUpper(fdi)).toBe(true)
    for (const fdi of [...LOWER_PERMANENT, ...LOWER_DECIDUOUS]) expect(isUpper(fdi)).toBe(false)
  })

  it('names every tooth exactly once across all four rows', () => {
    const all = [...UPPER_PERMANENT, ...LOWER_PERMANENT, ...UPPER_DECIDUOUS, ...LOWER_DECIDUOUS]
    expect(all).toHaveLength(52)
    expect(new Set(all).size).toBe(52)
  })
})

describe('which rows are drawn', () => {
  // As on the PDA chart, the baby-teeth rows sit outside the permanent ones.
  it('orders the rows as the PDA chart does — temporary outside', () => {
    expect(rowsFor('mixed').map((r) => r.key)).toEqual([
      'upper-deciduous',
      'upper-permanent',
      'lower-permanent',
      'lower-deciduous',
    ])
  })

  it('shows only the permanent rows for an adult', () => {
    expect(rowsFor('permanent').map((r) => r.key)).toEqual(['upper-permanent', 'lower-permanent'])
  })

  it('shows only the deciduous rows for a small child', () => {
    expect(rowsFor('deciduous').map((r) => r.key)).toEqual([
      'upper-deciduous',
      'lower-deciduous',
    ])
  })
})

describe('the dentition to open on', () => {
  /** A guess from age, never an assertion — the clinician can always override. */
  it.each([
    [2, 'deciduous'], [5, 'deciduous'],
    [6, 'mixed'], [9, 'mixed'], [13, 'mixed'],
    [14, 'permanent'], [40, 'permanent'],
  ])('opens a %i-year-old on the %s dentition', (age, expected) => {
    expect(dentitionForAge(age)).toBe(expected)
  })

  it('assumes permanent when the age is unknown', () => {
    // Showing a full adult mouth is the safe default: every tooth is chartable,
    // which is not true of guessing deciduous.
    expect(dentitionForAge(null)).toBe('permanent')
    expect(dentitionForAge(undefined)).toBe('permanent')
  })
})

describe('quadrant labels', () => {
  it.each([[11, 'UR'], [18, 'UR'], [55, 'UR'], [21, 'UL'], [65, 'UL'], [31, 'LL'], [75, 'LL'], [41, 'LR'], [85, 'LR']])(
    'labels tooth %i as %s',
    (fdi, label) => {
      expect(quadrantLabel(fdi)).toBe(label)
    },
  )
})

describe('tooth names', () => {
  it('names permanent teeth by jaw, side and position', () => {
    expect(toothName(16)).toBe('Upper right first molar')
    expect(toothName(21)).toBe('Upper left central incisor')
    expect(toothName(48)).toBe('Lower right third molar')
    expect(toothName(33)).toBe('Lower left canine')
  })

  it('says primary for a deciduous tooth', () => {
    expect(toothName(55)).toBe('Upper right primary second molar')
    expect(toothName(71)).toBe('Lower left primary central incisor')
  })
})

/**
 * Universal notation, offered as a display toggle only.
 *
 * The trap is that Universal runs clockwise from the upper-right third molar, so
 * the *lower left* is 17–24 and the lower right is 25–32 — the opposite way
 * round from the upper arch.
 */
describe('FDI to Universal', () => {
  it.each([
    [18, '1'], [11, '8'], [21, '9'], [28, '16'],
    [38, '17'], [31, '24'], [41, '25'], [48, '32'],
  ])('converts permanent tooth %i to %s', (fdi, universal) => {
    expect(toUniversal(fdi)).toBe(universal)
  })

  it.each([
    [55, 'A'], [51, 'E'], [61, 'F'], [65, 'J'],
    [75, 'K'], [71, 'O'], [81, 'P'], [85, 'T'],
  ])('converts deciduous tooth %i to %s', (fdi, universal) => {
    expect(toUniversal(fdi)).toBe(universal)
  })

  it('covers 1 to 32 exactly, with no gaps and no repeats', () => {
    const numbers = [...UPPER_PERMANENT, ...LOWER_PERMANENT].map((fdi) => Number(toUniversal(fdi)))
    expect(numbers.sort((a, b) => a - b)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1))
  })

  it('covers A to T exactly', () => {
    const letters = [...UPPER_DECIDUOUS, ...LOWER_DECIDUOUS].map(toUniversal).sort()
    expect(letters.join('')).toBe('ABCDEFGHIJKLMNOPQRST')
  })
})
