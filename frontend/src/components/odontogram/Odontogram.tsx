'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'

import './odontogram.css'
import { ToothCell, type ToothState } from './ToothCell'
import {
  columnOf,
  rowIsUpper,
  rowsFor,
  type Dentition,
} from '@/lib/odontogram/layout'
import type { Surface } from '@/lib/odontogram/surfaces'

/**
 * The tooth chart.
 *
 * ## Two-step selection, and it is not a compromise
 *
 * Tap a tooth, then pick surfaces in a dedicated control. The arithmetic leaves
 * no alternative: a 44pt surface target needs a 132pt tooth, and sixteen of
 * those is 2112pt against an iPad Pro 13"'s 1366pt in landscape. Every serious
 * dental product works this way for the same reason.
 *
 * Direct surface clicking stays enabled for a mouse, where the regions are
 * ≥24px and clear WCAG 2.5.8 at AA — an accelerator for the desk, never the only
 * way in.
 *
 * ## Keyboard
 *
 * The arch is a `listbox` and each tooth an `option`. Left/right walk the row,
 * up/down cross between arches at the same column — which only works because
 * the columns line up, and they did not before: the lower arch was mirrored, so
 * pressing Down from tooth 11 would have landed on 31, the opposite side of the
 * mouth.
 */

export interface OdontogramProps {
  /** `tooth → surface → finding`, with `*` for a whole-tooth finding. */
  chart: Record<number, ToothState>
  dentition?: Dentition
  readOnly?: boolean
  notation?: 'fdi' | 'universal'
  /** Cell width in px. 76 is the default; ≥72 keeps surfaces at the WCAG floor. */
  size?: number
  selected?: number | null
  /** Surfaces charted a moment ago, keyed by tooth — drives the bloom. */
  justCharted?: Record<number, Surface[]>
  savedTooth?: number | null
  onSelect?: (fdi: number | null) => void
  onSurface?: (fdi: number, surface: Surface) => void
}

export function Odontogram({
  chart,
  dentition = 'permanent',
  readOnly = false,
  notation = 'fdi',
  size = 76,
  selected = null,
  justCharted = {},
  savedTooth = null,
  onSelect,
  onSurface,
}: OdontogramProps) {
  const rows = useMemo(() => rowsFor(dentition), [dentition])
  const gridRef = useRef<HTMLDivElement>(null)

  // Focus follows selection, so keyboard and pointer cannot disagree about
  // which tooth is active.
  useEffect(() => {
    if (selected == null || readOnly) return
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-fdi="${selected}"]`)
    if (el && document.activeElement !== el) el.focus({ preventScroll: true })
  }, [selected, readOnly])

  const move = useCallback(
    (fdi: number, key: string) => {
      const rowIndex = rows.findIndex((r) => r.teeth.includes(fdi))
      if (rowIndex === -1) return

      const row = rows[rowIndex]
      const { index } = columnOf(row, fdi)

      if (key === 'ArrowLeft' || key === 'ArrowRight') {
        const next = row.teeth[index + (key === 'ArrowRight' ? 1 : -1)]
        if (next != null) onSelect?.(next)
        return
      }

      // Up and down cross arches at the same column. The deciduous rows are
      // shorter, so the column is remapped through the fraction of the row
      // rather than the raw index — otherwise Down from an upper molar would
      // fall off the end of a ten-tooth row.
      const target = rows[rowIndex + (key === 'ArrowDown' ? 1 : -1)]
      if (!target) return

      const fraction = (index + 0.5) / row.teeth.length
      const mapped = Math.min(
        target.teeth.length - 1,
        Math.max(0, Math.round(fraction * target.teeth.length - 0.5)),
      )
      onSelect?.(target.teeth[mapped])
    },
    [rows, onSelect],
  )

  return (
    <div
      className="odontogram"
      role="group"
      aria-label="Tooth chart, FDI numbering"
      onKeyDown={(e) => {
        if (readOnly) return
        if (e.key === 'Escape') {
          onSelect?.(null)
          return
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return

        const fdi = Number((e.target as HTMLElement).closest('[data-fdi]')?.getAttribute('data-fdi'))
        if (!Number.isFinite(fdi)) return

        e.preventDefault()
        move(fdi, e.key)
      }}
    >
      <div className="od-scroll" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div ref={gridRef} className="mx-auto" style={{ minWidth: 'min-content', padding: '4px 2px' }}>
          {rows.map((row, rowIndex) => {
            const upper = rowIsUpper(row)
            const half = row.teeth.length / 2

            return (
              <div key={row.key}>
                <div
                  className="od-row"
                  data-jaw={upper ? 'upper' : 'lower'}
                  role="listbox"
                  aria-label={row.label}
                  aria-orientation="horizontal"
                >
                  {row.teeth.map((fdi, i) => (
                    <div key={fdi} className="flex items-end" style={{ order: i }}>
                      {i === half && <span className="od-midline" aria-hidden="true" />}
                      <ToothCell
                        fdi={fdi}
                        state={chart[fdi] ?? { surfaces: {} }}
                        upper={upper}
                        selected={selected === fdi}
                        readOnly={readOnly}
                        // Staggered from the midline outward, so the arch
                        // assembles from the centre of the mouth rather than
                        // wiping in from one side.
                        delay={Math.abs(i - half + 0.5) * 16 + rowIndex * 40}
                        justCharted={justCharted[fdi]}
                        savedPulse={savedTooth === fdi}
                        notation={notation}
                        size={size}
                        onSelect={(t) => onSelect?.(selected === t ? null : t)}
                        onSurface={onSurface}
                      />
                    </div>
                  ))}
                </div>

                {/* The occlusal plane, drawn once between the two permanent
                    arches — the heaviest line on the chart, as on the PDA form. */}
                {row.key === 'upper-permanent' && (
                  <div className="od-occlusal-plane" aria-hidden="true" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div
        className="flex items-center justify-between px-1 pt-1 text-xs font-medium"
        style={{ color: 'var(--od-label)' }}
        aria-hidden="true"
      >
        {/* Dentist's view. Stated on the chart because it is the one thing a
            reader must not get backwards. */}
        <span>Patient&rsquo;s right</span>
        <span>Patient&rsquo;s left</span>
      </div>
    </div>
  )
}

/**
 * The loading state: the real grid, in outline.
 *
 * Not shimmer blocks. The chart is a fixed-shape object, so drawing its true
 * geometry means **zero layout shift** when the data lands, and a clinician can
 * orient — and even reach for a tooth — before it does.
 */
export function OdontogramSkeleton({
  dentition = 'permanent',
  size = 76,
}: {
  dentition?: Dentition
  size?: number
}) {
  const rows = rowsFor(dentition)

  return (
    <div className="odontogram" aria-busy="true" aria-label="Loading tooth chart">
      <div className="od-scroll" style={{ overflowX: 'auto' }}>
        <div className="mx-auto od-skeleton" style={{ minWidth: 'min-content', padding: '4px 2px' }}>
          {rows.map((row) => {
            const upper = rowIsUpper(row)
            const half = row.teeth.length / 2

            return (
              <div key={row.key}>
                <div className="od-row" data-jaw={upper ? 'upper' : 'lower'}>
                  {row.teeth.map((fdi, i) => (
                    <div key={fdi} className="flex items-end">
                      {i === half && <span className="od-midline" aria-hidden="true" />}
                      <SkeletonTooth size={size} upper={upper} />
                    </div>
                  ))}
                </div>
                {row.key === 'upper-permanent' && (
                  <div className="od-occlusal-plane" aria-hidden="true" />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/**
 * One outlined tooth.
 *
 * The root was two bordered divs squeezed with `scaleX`, which rendered as a
 * pair of stray vertical hairlines rather than a tooth — the skeleton looked
 * broken instead of pending. Drawn as the same SVG shape the real cell uses, so
 * the placeholder is the geometry it is standing in for and nothing shifts when
 * the data lands.
 */
function SkeletonTooth({ size, upper }: { size: number; upper: boolean }) {
  const rootHeight = Math.round(size * 0.46)
  const box = (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        border: '1.5px solid var(--od-tooth-edge)',
        background: 'var(--od-tooth)',
      }}
    />
  )

  const root = (
    <svg width={size} height={rootHeight} viewBox="0 0 100 46" aria-hidden="true" style={{ display: 'block' }}>
      <path
        d={upper ? 'M 30 46 C 30 24, 44 24, 46 2 L 54 2 C 56 24, 70 24, 70 46 Z' : 'M 30 0 C 30 22, 44 22, 46 44 L 54 44 C 56 22, 70 22, 70 0 Z'}
        fill="var(--od-root)"
        stroke="var(--od-root-edge)"
        strokeWidth="1.2"
      />
    </svg>
  )

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      {upper ? (
        <>
          {root}
          {box}
        </>
      ) : (
        <>
          {box}
          {root}
        </>
      )}
    </div>
  )
}

