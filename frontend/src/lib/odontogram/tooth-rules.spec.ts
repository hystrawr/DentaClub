import { describe, expect, it } from 'vitest'
import type { OdontogramEvent } from '@/lib/api/odontogram'
import { CONDITIONS } from './conditions'
import { allowedFindings, isAllowedOn, toothFoundation, toothRuleNote } from './tooth-rules'

const all = CONDITIONS.map((c) => c.code)

let id = 0
/** A history entry, newest-first lists being what the chart panel receives. */
const ev = (code: string | null, status = 'final'): OdontogramEvent =>
  ({ id: ++id, tooth_number: 16, condition_code: code, status, observed_at: `2026-01-${String(id).padStart(2, '0')}T09:00:00+08:00` }) as OdontogramEvent

describe('allowedFindings', () => {
  it('allows anything on a natural tooth', () => {
    expect(allowedFindings(undefined)).toBeNull()
  })

  it('allows only an implant, a pontic or a removable denture where the tooth is missing or extracted', () => {
    for (const absent of ['missing', 'missing_other', 'extraction', 'extraction_other']) {
      expect(allowedFindings(absent)).toEqual(['implant', 'pontic', 'removable_denture'])
    }
    expect(isAllowedOn('missing', 'amalgam')).toBe(false)
    expect(isAllowedOn('extraction', 'root_canal')).toBe(false)
    expect(isAllowedOn('missing', 'implant')).toBe(true)
  })

  it('allows nothing more on a removable denture or a pontic', () => {
    for (const base of ['removable_denture', 'pontic']) {
      expect(allowedFindings(base)).toEqual([])
      expect(all.some((code) => isAllowedOn(base, code))).toBe(false)
    }
  })

  it('allows only a crown or an abutment on an implant', () => {
    expect(allowedFindings('implant')).toEqual(['crown', 'abutment'])
    expect(isAllowedOn('implant', 'sealant')).toBe(false)
  })

  it('only names codes the chart actually has', () => {
    for (const base of ['missing', 'implant', 'pontic', 'removable_denture']) {
      for (const code of allowedFindings(base) ?? []) expect(all).toContain(code)
    }
  })
})

describe('toothFoundation', () => {
  it('is nothing for a natural tooth, whatever is charted on it', () => {
    expect(toothFoundation([ev('crown'), ev('amalgam')])).toBeUndefined()
  })

  it('stays an implant after a crown goes on it, so a filling is still refused', () => {
    const history = [ev('crown'), ev('implant'), ev('missing')] // newest first
    expect(toothFoundation(history)).toBe('implant')
    expect(isAllowedOn(toothFoundation(history), 'amalgam')).toBe(false)
  })

  it('ignores a finding marked entered in error or replaced', () => {
    expect(toothFoundation([ev(null), ev('missing', 'entered-in-error')])).toBeUndefined()
    expect(toothFoundation([ev('removable_denture', 'corrected'), ev('extraction')])).toBe('extraction')
  })
})

describe('toothRuleNote', () => {
  it('says why the options are limited, and nothing when they are not', () => {
    expect(toothRuleNote(16, 'missing')).toMatch(/Tooth 16 is missing/)
    expect(toothRuleNote(16, 'removable_denture')).toMatch(/removable denture/)
    expect(toothRuleNote(16, 'pontic')).toMatch(/pontic/)
    expect(toothRuleNote(16, undefined)).toBeNull()
  })
})
