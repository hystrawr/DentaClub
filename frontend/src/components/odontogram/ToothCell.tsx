'use client'

import { memo } from 'react'

import { conditionFor, STATUS_STYLES, type ChartStatus } from '@/lib/odontogram/conditions'
import { toothName, toUniversal } from '@/lib/odontogram/layout'
import {
  isAnterior,
  surfaceName,
  surfacesByRegion,
  type Region,
  type Surface,
} from '@/lib/odontogram/surfaces'

/**
 * One tooth: its number, its root and its five surfaces. Whole-tooth states
 * (missing, implant, root canal) are drawn on the root; caries and fillings in
 * the surface box. Which drawn region is which surface depends on the quadrant
 * (see `lib/odontogram/surfaces.ts`).
 */

const POSTERIOR_REGIONS: Record<Region, string> = {
  top: '0,0 100,0 75,25 25,25',
  right: '100,0 100,100 75,75 75,25',
  bottom: '100,100 0,100 25,75 75,75',
  left: '0,100 0,0 25,25 25,75',
  centre: '25,25 75,25 75,75 25,75',
}

/** An incisal edge is wide and shallow, not square. */
const ANTERIOR_REGIONS: Record<Region, string> = {
  top: '0,0 100,0 75,37.5 25,37.5',
  right: '100,0 100,100 75,62.5 75,37.5',
  bottom: '100,100 0,100 25,62.5 75,62.5',
  left: '0,100 0,0 25,37.5 25,62.5',
  centre: '25,37.5 75,37.5 75,62.5 25,62.5',
}

export interface ToothState {
  /** Per-surface findings. */
  surfaces: Partial<Record<Surface, { code: string; status: ChartStatus }>>
  /** A whole-tooth finding, if any. */
  whole?: { code: string; status: ChartStatus }
  /** Has a note, an image, or something else worth a flag. */
  flags?: string[]
}

interface ToothCellProps {
  fdi: number
  state: ToothState
  upper: boolean
  selected: boolean
  readOnly: boolean
  /** Milliseconds of entrance delay, set from distance to the midline. */
  delay: number
  /** Surfaces charted in the last moment, for the bloom animation. */
  justCharted?: Surface[]
  savedPulse?: boolean
  notation: 'fdi' | 'universal'
  size: number
  onSelect: (fdi: number) => void
  onSurface?: (fdi: number, surface: Surface) => void
}

/** Wrapped in `memo` below, so charting one tooth does not redraw the other 31. */
function ToothCellInner({
  fdi,
  state,
  upper,
  selected,
  readOnly,
  delay,
  justCharted = [],
  savedPulse = false,
  notation,
  size,
  onSelect,
  onSurface,
}: ToothCellProps) {
  const byRegion = surfacesByRegion(fdi)
  const regions = isAnterior(fdi) ? ANTERIOR_REGIONS : POSTERIOR_REGIONS

  const whole = state.whole ? conditionFor(state.whole.code) : undefined
  const wholeTone = whole ? `var(--od-${whole.tone})` : undefined
  // A tooth that is not there is drawn hollow, and its surfaces stop mattering.
  const absent = Boolean(
    whole && ['missing', 'missing_other', 'extraction', 'extraction_other', 'unerupted'].includes(whole.code),
  )

  const boxSize = size
  const rootHeight = Math.round(size * 0.46)
  const labelSize = Math.max(10, Math.round(size * 0.15))

  const label = notation === 'universal' ? toUniversal(fdi) : String(fdi)

  const number = (
    <span
      className="font-medium select-none"
      style={{
        fontSize: labelSize,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.02em',
        color: selected ? 'var(--od-accent)' : 'var(--od-label)',
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  )

  const root = (
    <svg
      width={boxSize}
      height={rootHeight}
      viewBox={`0 0 100 ${Math.round((rootHeight / boxSize) * 100)}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <RootSilhouette
        fdi={fdi}
        upper={upper}
        height={Math.round((rootHeight / boxSize) * 100)}
        tone={wholeTone}
        code={whole?.code}
        absent={absent}
        status={state.whole?.status}
      />
    </svg>
  )

  const box = (
    <svg
      width={boxSize}
      height={boxSize}
      viewBox="0 0 100 100"
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="0.5"
        width="99"
        height="99"
        rx="7"
        fill="var(--od-tooth)"
        stroke="var(--od-tooth-edge)"
        strokeWidth="1.5"
        opacity={absent ? 0.3 : 1}
      />

      {(Object.keys(regions) as Region[]).map((region) => {
        const surface = byRegion[region]
        const finding = absent ? undefined : state.surfaces[surface]
        const def = finding ? conditionFor(finding.code) : undefined
        const style = finding ? STATUS_STYLES[finding.status] : undefined
        const outlineOnly = def?.pattern === 'outline'

        return (
          <polygon
            key={region}
            className="od-surface"
            data-just-charted={justCharted.includes(surface) ? 'true' : undefined}
            points={regions[region]}
            fill={def ? `var(--od-${def.tone})` : 'transparent'}
            fillOpacity={
              def ? (outlineOnly ? (style?.fill ?? 1) * 0.16 : style?.fill ?? 1) : 0
            }
            stroke={def ? `var(--od-${def.tone})` : 'var(--od-tooth-edge)'}
            // Unpainted surfaces stay visible, since they are what gets clicked.
            strokeWidth={def ? style?.strokeWidth ?? 1 : 1}
            strokeDasharray={style?.dashed ? '3 2' : undefined}
            strokeOpacity={def ? 1 : 0.85}
            onClick={
              readOnly || !onSurface
                ? undefined
                : (e) => {
                    e.stopPropagation()
                    onSurface(fdi, surface)
                  }
            }
            style={{ cursor: readOnly ? 'default' : 'pointer' }}
          />
        )
      })}

      {/* The PDA two-letter code, which is what keeps this legible in mono. */}
      {(Object.keys(regions) as Region[]).map((region) => {
        const surface = byRegion[region]
        const finding = absent ? undefined : state.surfaces[surface]
        const def = finding ? conditionFor(finding.code) : undefined
        if (!def || region !== 'centre') return null

        return (
          <text
            key={`t-${region}`}
            x="50"
            y={isAnterior(fdi) ? 54 : 56}
            textAnchor="middle"
            fontSize="20"
            fontWeight="700"
            fill={STATUS_STYLES[finding!.status].fill > 0.5 ? '#FFFFFF' : `var(--od-${def.tone})`}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {def.short}
          </text>
        )
      })}

      {/* Focus and selection rings, outside the tooth so they never hide a finding. */}
      <rect
        className="od-focus-ring"
        x="-2.5"
        y="-2.5"
        width="105"
        height="105"
        rx="9"
        fill="none"
      />
      {selected && (
        <rect
          className="od-ring"
          x="-2.5"
          y="-2.5"
          width="105"
          height="105"
          rx="9"
          fill="none"
          stroke="var(--od-accent)"
          strokeWidth="2.5"
          style={{ ['--od-ring-length' as string]: '420' }}
        />
      )}
      {savedPulse && (
        <rect
          className="od-saved-pulse"
          x="-1"
          y="-1"
          width="102"
          height="102"
          rx="8"
          fill="none"
        />
      )}
    </svg>
  )

  const described = [
    toothName(fdi),
    state.whole ? conditionFor(state.whole.code)?.label : null,
    ...Object.entries(state.surfaces).map(
      ([surface, finding]) =>
        `${surfaceName(fdi, surface as Surface)}: ${conditionFor(finding.code)?.label ?? finding.code}`,
    ),
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div
      className="od-tooth flex flex-col items-center"
      role="option"
      aria-selected={selected}
      aria-label={described || `${toothName(fdi)}, not charted`}
      tabIndex={readOnly ? -1 : 0}
      data-selected={selected}
      data-readonly={readOnly}
      data-fdi={fdi}
      style={{
        ['--od-delay' as string]: `${delay}ms`,
        ['--od-erupt-from' as string]: upper ? '-8px' : '8px',
        width: boxSize,
      }}
      onClick={() => !readOnly && onSelect(fdi)}
      onKeyDown={(e) => {
        if (readOnly) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(fdi)
        }
      }}
    >
      {/* Upper teeth: number, root, then the box; lower teeth are the mirror image. */}
      {upper ? (
        <>
          {number}
          {root}
          {box}
        </>
      ) : (
        <>
          {box}
          {root}
          {number}
        </>
      )}
    </div>
  )
}

/** The root silhouette, and every whole-tooth state drawn on it. */
function RootSilhouette({
  fdi,
  upper,
  height,
  tone,
  code,
  absent,
  status,
}: {
  fdi: number
  upper: boolean
  height: number
  tone?: string
  code?: string
  absent: boolean
  status?: ChartStatus
}) {
  const position = fdi % 10
  // Upper molars have three roots, lower molars two, premolars one (the upper first premolar two).
  const roots = position >= 6 ? (upper ? 3 : 2) : 1
  const dashed = status ? STATUS_STYLES[status].dashed : false

  // Upper roots point up, away from the occlusal plane below; lower point down.
  const apex = upper ? 2 : height - 2
  const base = upper ? height : 0
  const mid = (base + apex) / 2

  // Each root is its own tapered shape, so a root canal can be drawn down each one.
  const spread = roots === 1 ? [50] : roots === 2 ? [30, 70] : [26, 50, 74]
  const halfWidth = roots === 1 ? 20 : roots === 2 ? 15 : 11
  const tipWidth = roots === 1 ? 8 : 5

  const rootPaths = spread.map(
    (cx) =>
      `M ${cx - halfWidth} ${base} ` +
      `C ${cx - halfWidth} ${mid}, ${cx - tipWidth} ${mid}, ${cx - tipWidth * 0.7} ${apex} ` +
      `L ${cx + tipWidth * 0.7} ${apex} ` +
      `C ${cx + tipWidth} ${mid}, ${cx + halfWidth} ${mid}, ${cx + halfWidth} ${base} Z`,
  )

  /** The canal, for a root-filled tooth — one line down the centre of each root. */
  const canals = spread.map((cx) => `M ${cx} ${base - (upper ? 2 : -2)} L ${cx} ${apex}`)

  const fillTone = code === 'unerupted' || absent ? 'transparent' : 'var(--od-root)'

  return (
    <g opacity={absent ? 0.45 : 1}>
      {rootPaths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={fillTone}
          stroke="var(--od-root-edge)"
          strokeWidth="1.2"
          strokeDasharray={code === 'unerupted' ? '3 2' : undefined}
        />
      ))}

      {/* A crown or denture caps the whole tooth — a filled band, not a hairline. */}
      {(code === 'crown' || code === 'removable_denture') && tone && (
        <rect
          x="8"
          y={upper ? base - 14 : 0}
          width="84"
          height="14"
          rx="4"
          fill={tone}
          fillOpacity={dashed ? 0.25 : 0.9}
          stroke={tone}
          strokeWidth="1.5"
          strokeDasharray={dashed ? '4 3' : undefined}
        />
      )}

      {/* Root canal: the canal filled down every root, with the apex marked. */}
      {code === 'root_canal' &&
        canals.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--od-endo)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={dashed ? '4 3' : undefined}
          />
        ))}

      {/* Implant: a threaded fixture, drawn where the root would be. */}
      {code === 'implant' && (
        <>
          <path
            d={`M 36 ${base} L 64 ${base} L 58 ${apex} L 42 ${apex} Z`}
            fill="var(--od-implant)"
            fillOpacity="0.22"
            stroke="var(--od-implant)"
            strokeWidth="1.5"
          />
          {Array.from({ length: 5 }, (_, i) => {
            const t = (i + 1) / 6
            const y = base + (apex - base) * t
            const w = 13 - t * 4
            return (
              <line
                key={i}
                x1={50 - w}
                y1={y}
                x2={50 + w}
                y2={y}
                stroke="var(--od-implant)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )
          })}
        </>
      )}

      {/* Impacted: a bar across the root, the way the paper chart marks it. */}
      {code === 'impacted' && (
        <line
          x1="14"
          y1={mid}
          x2="86"
          y2={mid}
          stroke="var(--od-missing)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}

      {/* Missing or extracted: the diagonal cross, drawn on. */}
      {absent && code !== 'unerupted' && (
        <>
          <line
            className="od-strike"
            x1="12"
            y1={Math.min(base, apex) + 2}
            x2="88"
            y2={Math.max(base, apex) - 2}
            stroke="var(--od-missing)"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <line
            className="od-strike"
            x1="88"
            y1={Math.min(base, apex) + 2}
            x2="12"
            y2={Math.max(base, apex) - 2}
            stroke="var(--od-missing)"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{ ['--od-strike-delay' as string]: '120ms' }}
          />
        </>
      )}
    </g>
  )
}

/** Memoised: a full mouth is 32–52 of these and only the touched one changes. */
export const ToothCell = memo(ToothCellInner)
