import type { OdontogramEvent, SurfaceChart } from '@/lib/api/odontogram'
import type { ToothState } from '@/components/odontogram/ToothCell'
import { chartStatusFor, conditionFor } from './conditions'
import type { Surface } from './surfaces'

/**
 * The API's surface chart, turned into what the chart draws. An unknown
 * condition code is skipped, never guessed at: a wrong colour is worse than none.
 */
export function toChart(chart: SurfaceChart | undefined): Record<number, ToothState> {
  if (!chart) return {}

  const out: Record<number, ToothState> = {}

  for (const [tooth, surfaces] of Object.entries(chart)) {
    const fdi = Number(tooth)
    if (!Number.isFinite(fdi)) continue

    const state: ToothState = { surfaces: {} }

    for (const [surface, event] of Object.entries(surfaces)) {
      if (!event.condition_code || !conditionFor(event.condition_code)) continue

      const finding = {
        code: event.condition_code,
        status: chartStatusFor(event.status, event.event_type),
      }

      // `*` is the API's key for a finding on the whole tooth.
      // `base` is what that finding sits on: the implant under a crown.
      if (surface === '*') state.whole = finding
      else if (surface === 'base') state.base = finding
      else state.surfaces[surface as Surface] = finding
    }

    out[fdi] = state
  }

  return out
}

/** The chart in words ("Decayed: 16 MOD"), for the findings summary and screen readers. */
export function summarise(chart: Record<number, ToothState>): string[] {
  const lines: string[] = []
  const teeth = Object.keys(chart).map(Number).sort((a, b) => a - b)

  const wholeByCode = new Map<string, number[]>()
  const surfaceByCode = new Map<string, string[]>()

  for (const fdi of teeth) {
    const state = chart[fdi]

    for (const finding of [state.base, state.whole]) {
      if (finding) wholeByCode.set(finding.code, [...(wholeByCode.get(finding.code) ?? []), fdi])
    }

    // One entry per tooth and condition: "16 MOD", not "16 M, 16 O, 16 D".
    const byCode = new Map<string, Surface[]>()
    for (const [surface, finding] of Object.entries(state.surfaces)) {
      byCode.set(finding.code, [...(byCode.get(finding.code) ?? []), surface as Surface])
    }
    for (const [code, surfaces] of byCode) {
      surfaceByCode.set(code, [...(surfaceByCode.get(code) ?? []), `${fdi} ${surfaces.join('')}`])
    }
  }

  for (const [code, list] of wholeByCode) {
    const def = conditionFor(code)
    lines.push(`${def?.label ?? code}: ${list.join(', ')}`)
  }
  for (const [code, list] of surfaceByCode) {
    const def = conditionFor(code)
    lines.push(`${def?.label ?? code}: ${list.join(', ')}`)
  }

  return lines
}

/** Findings for one tooth, newest first — the per-tooth history panel. */
export function historyForTooth(
  events: OdontogramEvent[] | undefined,
  fdi: number,
): OdontogramEvent[] {
  return (events ?? [])
    .filter((e) => e.tooth_number === fdi)
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at) || b.id - a.id)
}
