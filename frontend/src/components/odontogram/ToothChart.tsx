'use client'

import { useMemo, useState } from 'react'

import { ChartLegend } from './ChartLegend'
import { ChartScrubber } from './ChartScrubber'
import { FindingsSummary } from './FindingsSummary'
import { Odontogram, OdontogramSkeleton } from './Odontogram'
import { ToothInspector } from './ToothInspector'
import {
  chartDates,
  useChartToothEvent,
  useSupersedeToothEvent,
  useToothChart,
  useToothHistory,
} from '@/lib/api/odontogram'
import { isWholeTooth } from '@/lib/odontogram/conditions'
import { dentitionForAge, type Dentition } from '@/lib/odontogram/layout'
import type { Surface } from '@/lib/odontogram/surfaces'
import { historyForTooth, summarise, toChart } from '@/lib/odontogram/to-chart'

/**
 * The whole charting screen: controls, the chart, the charting panel docked
 * under it, then the findings summary and legend. Every change is appended as a
 * new event. Viewing a past date is read-only, so nothing is back-dated by accident.
 */
export function ToothChart({
  patientId,
  patientAge,
  encounterId,
  variant = 'desk',
  readOnly = false,
}: {
  patientId: string
  patientAge?: number | null
  /** Ties findings to the visit they were made at. */
  encounterId?: string
  variant?: 'desk' | 'chair'
  readOnly?: boolean
}) {
  const [asOf, setAsOf] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [dentition, setDentition] = useState<Dentition | null>(null)
  const [notation, setNotation] = useState<'fdi' | 'universal'>('fdi')
  const [justCharted, setJustCharted] = useState<Record<number, Surface[]>>({})
  const [savedTooth, setSavedTooth] = useState<number | null>(null)

  const chartQuery = useToothChart(patientId, asOf ?? undefined)
  const historyQuery = useToothHistory(patientId)
  const chartEvent = useChartToothEvent(patientId)
  const supersede = useSupersedeToothEvent(patientId)

  const chart = useMemo(() => toChart(chartQuery.data), [chartQuery.data])
  const lines = useMemo(() => summarise(chart), [chart])
  const dates = useMemo(() => chartDates(historyQuery.data), [historyQuery.data])

  // Opens on a dentition guessed from age; a choice the user makes always wins.
  const shown = dentition ?? dentitionForAge(patientAge)
  const viewingPast = asOf !== null
  const editable = !readOnly && !viewingPast

  const missingCount = Object.values(chart).filter((t) =>
    ['missing', 'missing_other', 'extraction', 'extraction_other'].includes(t.whole?.code ?? ''),
  ).length

  /** Flash the surfaces just written, then let the animation class fall away. */
  function flash(fdi: number, surfaces: Surface[]) {
    setJustCharted({ [fdi]: surfaces })
    setSavedTooth(fdi)
    window.setTimeout(() => setJustCharted({}), 400)
    window.setTimeout(() => setSavedTooth(null), 1000)
  }

  // Chairside cells are a little smaller so a full arch fits a tablet.
  const size = variant === 'chair' ? 72 : 78

  return (
    <div className="space-y-4">
      {/* ─── Controls ──────────────────────────────────────────────────── */}
      <div className="odontogram flex items-center justify-between gap-3 flex-wrap" data-print="hide">
        <div className="flex items-center gap-1.5">
          {(['permanent', 'mixed', 'deciduous'] as Dentition[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDentition(option)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-all"
              style={{
                minHeight: 34,
                border: `1px solid ${shown === option ? 'var(--od-accent)' : 'var(--color-border)'}`,
                background: shown === option ? 'var(--od-accent-soft)' : 'var(--color-surface)',
                color: shown === option ? 'var(--od-accent)' : 'var(--color-muted-foreground)',
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setNotation((n) => (n === 'fdi' ? 'universal' : 'fdi'))}
          className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            minHeight: 34,
            border: '1px solid var(--color-border)',
            color: 'var(--color-muted-foreground)',
          }}
          title="FDI is what is stored. Universal is shown for records from the US."
        >
          {notation === 'fdi' ? 'FDI' : 'Universal'}
        </button>
      </div>

      {/* ─── The chart ─────────────────────────────────────────────────── */}
      <div className="py-2">
        {chartQuery.isLoading ? (
          <OdontogramSkeleton dentition={shown} size={size} />
        ) : chartQuery.isError ? (
          // Never show an empty chart when loading failed: it would look like a healthy mouth.
          <p className="py-8 text-center text-sm" role="alert" style={{ color: 'var(--color-destructive)' }}>
            The chart could not be loaded. Do not treat this as an unmarked mouth — reload before
            charting.
          </p>
        ) : (
          <Odontogram
            chart={chart}
            dentition={shown}
            readOnly={!editable}
            notation={notation}
            size={size}
            selected={selected}
            justCharted={justCharted}
            savedTooth={savedTooth}
            onSelect={setSelected}
            onSurface={(fdi) => setSelected(fdi)}
          />
        )}
      </div>

      {/* ─── Charting, docked under the arch ───────────────────────────── */}
      {selected != null && editable && (
        <ToothInspector
          key={selected}
          fdi={selected}
          history={historyForTooth(historyQuery.data, selected)}
          busy={chartEvent.isPending || supersede.isPending}
          variant={variant}
          onClose={() => setSelected(null)}
          onChart={({ code, surfaces, notes }) => {
            const whole = isWholeTooth(code)
            chartEvent.mutate(
              {
                tooth_number: selected,
                event_type: 'condition',
                condition_code: code,
                // A whole-tooth finding is sent without surfaces.
                ...(whole ? {} : { surfaces }),
                ...(encounterId ? { encounter_id: encounterId } : {}),
                ...(notes ? { notes } : {}),
              },
              { onSuccess: () => flash(selected, whole ? [] : surfaces) },
            )
          }}
          onSupersede={({ replaces, kind, reason, code, surfaces }) => {
            supersede.mutate(
              {
                tooth_number: selected,
                event_type: 'condition',
                replaces,
                kind,
                reason,
                ...(code ? { condition_code: code } : {}),
                ...(surfaces?.length ? { surfaces } : {}),
                ...(encounterId ? { encounter_id: encounterId } : {}),
              },
              { onSuccess: () => flash(selected, surfaces ?? []) },
            )
          }}
        />
      )}

      {viewingPast && (
        <p
          className="text-xs rounded-lg px-3 py-2"
          style={{ background: '#FEF3C7', color: '#92400E' }}
        >
          Viewing the chart as it stood on {asOf}. Charting is disabled — return to today to record
          a finding.
        </p>
      )}

      <ChartScrubber dates={dates} value={asOf} onChange={setAsOf} />

      {/* ─── Findings and legend ───────────────────────────────────────── */}
      <div
        className="grid gap-x-8 gap-y-4 items-start pt-4"
        style={{
          borderTop: '1px solid var(--color-border)',
          gridTemplateColumns: variant === 'chair' ? '1fr' : 'minmax(0, 1fr) minmax(0, 360px)',
        }}
      >
        <FindingsSummary
          lines={lines}
          toothCount={Object.keys(chart).length}
          missingCount={missingCount}
        />
        <ChartLegend />
      </div>

      {(chartEvent.error || supersede.error) && (
        <p className="text-xs" role="alert" style={{ color: 'var(--color-destructive)' }}>
          {(chartEvent.error ?? supersede.error) instanceof Error
            ? (chartEvent.error ?? supersede.error)!.message
            : 'That finding could not be recorded.'}
        </p>
      )}
    </div>
  )
}
