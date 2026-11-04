import { describe, expect, it } from 'vitest'

import { overlapsLunch } from './lunch'

describe('the lunch break', () => {
  it('refuses any time that touches 12–1 PM', () => {
    expect(overlapsLunch('12:00', '13:00')).toBe(true)
    expect(overlapsLunch('11:30', '12:15')).toBe(true)
    expect(overlapsLunch('12:45', '13:30')).toBe(true)
    expect(overlapsLunch('11:00', '14:00')).toBe(true)
  })

  it('allows appointments that end at noon or start at 1 PM', () => {
    expect(overlapsLunch('11:30', '12:00')).toBe(false)
    expect(overlapsLunch('13:00', '13:30')).toBe(false)
    expect(overlapsLunch('09:00', '10:00')).toBe(false)
  })
})
