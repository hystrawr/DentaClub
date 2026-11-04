import { describe, expect, it } from 'vitest'

import { summarise, toChart } from './to-chart'
import type { SurfaceChart } from '@/lib/api/odontogram'

/** A sample chart event (caries on 16 O); `over` changes any field for one test. */
const event = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 1,
    tooth_number: 16,
    event_type: 'condition',
    surfaces: ['O'],
    condition_code: 'caries',
    notes: null,
    observed_at: '2026-09-01T00:00:00+08:00',
    created_at: '2026-09-01T00:00:00+08:00',
    replaces_event_id: null,
    supersession_type: null,
    supersession_reason: null,
    superseded_by_event_ids: [],
    status: 'final',
    ...over,
  }) as never

describe('folding the API chart', () => {
  it('keeps two separately diagnosed surfaces on one tooth', () => {
    const chart = toChart({
      16: { M: event({ condition_code: 'caries' }), O: event({ condition_code: 'amalgam' }) },
    } as unknown as SurfaceChart)

    expect(chart[16].surfaces.M?.code).toBe('caries')
    expect(chart[16].surfaces.O?.code).toBe('amalgam')
  })

  it('reads `*` as a whole-tooth finding', () => {
    const chart = toChart({
      16: { '*': event({ condition_code: 'missing', surfaces: null }) },
    } as unknown as SurfaceChart)

    expect(chart[16].whole?.code).toBe('missing')
    expect(chart[16].surfaces).toEqual({})
  })

  // A wrong colour is worse than none, because it looks deliberate.
  it('skips a condition code it does not recognise rather than guessing', () => {
    const chart = toChart({
      16: { O: event({ condition_code: 'something_invented' }) },
    } as unknown as SurfaceChart)

    expect(chart[16].surfaces.O).toBeUndefined()
  })

  it('skips an event with no condition code at all', () => {
    const chart = toChart({
      16: { O: event({ condition_code: null }) },
    } as unknown as SurfaceChart)

    expect(chart[16].surfaces.O).toBeUndefined()
  })

  it('marks a treatment as completed and a condition as existing', () => {
    const chart = toChart({
      16: { O: event({ condition_code: 'amalgam', event_type: 'treatment' }) },
      17: { O: event({ condition_code: 'caries', event_type: 'condition' }) },
    } as unknown as SurfaceChart)

    expect(chart[16].surfaces.O?.status).toBe('completed')
    expect(chart[17].surfaces.O?.status).toBe('existing')
  })

  it('marks a corrected finding as superseded', () => {
    const chart = toChart({
      16: { O: event({ condition_code: 'caries', status: 'corrected' }) },
    } as unknown as SurfaceChart)

    expect(chart[16].surfaces.O?.status).toBe('superseded')
  })

  it('is empty for no data rather than throwing', () => {
    expect(toChart(undefined)).toEqual({})
    expect(toChart({})).toEqual({})
  })
})

describe('the prose readback', () => {
  // Surfaces of one tooth with the same condition show as one entry (MOD, not M, O, D).
  it('collapses one tooth’s surfaces into a single code', () => {
    const chart = toChart({
      36: {
        M: event({ condition_code: 'amalgam' }),
        O: event({ condition_code: 'amalgam' }),
        D: event({ condition_code: 'amalgam' }),
      },
    } as unknown as SurfaceChart)

    expect(summarise(chart)).toEqual(['Amalgam filling: 36 MOD'])
  })

  it('lists teeth in ascending order, whatever order they arrived in', () => {
    const chart = toChart({
      36: { '*': event({ condition_code: 'missing', surfaces: null }) },
      11: { '*': event({ condition_code: 'missing', surfaces: null }) },
      24: { '*': event({ condition_code: 'missing', surfaces: null }) },
    } as unknown as SurfaceChart)

    expect(summarise(chart)).toEqual(['Missing: 11, 24, 36'])
  })

  it('separates conditions from restorations', () => {
    const chart = toChart({
      16: { O: event({ condition_code: 'caries' }) },
      26: { O: event({ condition_code: 'amalgam' }) },
    } as unknown as SurfaceChart)

    expect(summarise(chart).sort()).toEqual(['Amalgam filling: 26 O', 'Decayed: 16 O'])
  })

  it('says nothing for an unmarked mouth', () => {
    expect(summarise({})).toEqual([])
  })
})
