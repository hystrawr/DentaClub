'use client'

import { CalendarClock, RotateCcw } from 'lucide-react'

/**
 * A slider for viewing the chart as it stood on a past date (read-only). It
 * uses when each finding was true, so a later correction also updates the past view.
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
  // With fewer than two dates there is no past to look back to.
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
          className="flex items-center gap-1.5 text-xs font-medium"
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
          // The last stop is today, which is the live (editable) chart.
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
