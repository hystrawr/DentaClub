import type { OdontogramEvent, SurfaceChart } from '@/lib/api/odontogram'
import type { ToothState } from '@/components/odontogram/ToothCell'
import { chartStatusFor, conditionFor } from './conditions'
import type { Surface } from './surfaces'

/**
 * The API's surface chart, folded into what the component paints.
 *
 * The API already did the hard part — ordering by observation time, dropping
 * superseded and retracted events, deciding whether a finding covers the tooth
 * or its surfaces. This is a translation, and it keeps one rule of its own:
 *
 * **An unrecognised condition code is skipped, never guessed at.** A tooth
 * painted the wrong colour is worse than one left blank, because only the first
 * looks deliberate. The same reasoning the medical-history reader uses for an
 * allergy shape it does not know.
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

      if (surface === '*') state.whole = finding
      else state.surfaces[surface as Surface] = finding
    }

    out[fdi] = state
  }

  return out
}

/**
 * A prose readback of the chart.
 *
 * The highest-value, lowest-cost thing on the screen: it is readable, it
 * pastes into a clinical note, a screen reader gets it for free, and it catches
 * a mis-tap instantly — a clinician who charted the wrong tooth sees the wrong
 * number in a sentence long before they would spot it in a grid of thirty-two
 * boxes.
 */
export function summarise(chart: Record<number, ToothState>): string[] {
  const lines: string[] = []
  const teeth = Object.keys(chart).map(Number).sort((a, b) => a - b)

  const wholeByCode = new Map<string, number[]>()
  const surfaceByCode = new Map<string, string[]>()

  for (const fdi of teeth) {
    const state = chart[fdi]

    if (state.whole) {
      wholeByCode.set(state.whole.code, [...(wholeByCode.get(state.whole.code) ?? []), fdi])
    }

    // Surfaces of one tooth sharing a condition are one entry — "16 MOD", not
    // "16 M, 16 O, 16 D", which is how a chart of routine work becomes unreadable.
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
