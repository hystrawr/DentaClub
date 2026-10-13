'use client'

import { CalendarClock, RotateCcw } from 'lucide-react'

/**
 * The chart as it stood on a past date.
 *
 * Open Dental has had a slider under its tooth chart for years and it is the
 * best idea in the legacy corpus — nobody in the web-first tier has copied it.
 * It answers the question a recall visit actually asks: what did this mouth look
 * like last time, and what has changed?
 *
 * This is only possible because the events carry **valid time** separately from
 * when they were typed. Scrubbing filters on `observed_at`, so a correction
 * entered last week about a finding from January moves January's picture, which
 * is the honest answer.
 *
 * Past mode is read-only. Charting into the past through a scrubbed view would
 * be a different act — a back-dated entry — and it needs to be a deliberate one.
 */
export function ChartScrubber({
  dates,
  value,
  onChange,
}: {
  /** Every date on which the chart changed, ascending. */
  dates: string[]
  /** `null` is today. */
  value: string | null
  onChange: (date: string | null) => void
}) {
  if (dates.length < 2) return null

  const index = value ? dates.indexOf(value) : dates.length - 1
  const viewing = value ?? dates[dates.length - 1]

  const label = new Date(viewing).toLocaleDateString('en-PH', {
    dateStyle: 'medium',
    timeZone: 'Asia/Manila',
  })

  return (
    <div className="odontogram pt-4" style={{ borderTop: '1px solid var(--color-border)' }} data-print="hide">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-subtle-foreground)' }}
        >
          <CalendarClock size={11} /> Chart history
        </span>

        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors"
            style={{ background: 'var(--od-watch)', color: '#FFFFFF', minHeight: 30 }}
          >
            <RotateCcw size={11} /> Viewing {label} — back to today
          </button>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--color-muted-foreground)' }}>
            Today
          </span>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={dates.length - 1}
        value={index}
        step={1}
        aria-label="Chart date"
        aria-valuetext={label}
        onChange={(e) => {
          const next = Number(e.target.value)
          onChange(next === dates.length - 1 ? null : dates[next])
        }}
        className="w-full"
        style={{ accentColor: 'var(--od-accent)' }}
      />

      <div
        className="flex justify-between text-[10px] font-mono mt-1"
        style={{ color: 'var(--color-subtle-foreground)' }}
      >
        <span>{dates[0]}</span>
        <span>{dates.length} change{dates.length === 1 ? '' : 's'}</span>
        <span>today</span>
      </div>
    </div>
  )
}
