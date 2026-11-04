'use client'

import { AlertTriangle, Check, History, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  GROUP_LABELS,
  conditionFor,
  conditionsInGroup,
  isWholeTooth,
  type ConditionGroup,
} from '@/lib/odontogram/conditions'
import { isAllowedOn, toothFoundation, toothRuleNote } from '@/lib/odontogram/tooth-rules'
import { toothName } from '@/lib/odontogram/layout'
import {
  parseSurfaceCode,
  regionsBySurface,
  surfaceCode,
  surfaceName,
  surfacesOf,
  type Region,
  type Surface,
} from '@/lib/odontogram/surfaces'
import type { OdontogramEvent } from '@/lib/api/odontogram'

/**
 * The panel for charting one tooth, docked under the chart: what the finding
 * is, which surfaces, and the tooth's history. Typing a code such as `MOD`
 * selects those surfaces. A whole-tooth finding (missing, crown…) takes no
 * surfaces, and what the tooth already is limits what may be charted next.
 */

/** The 3×3 grid position of each region. */
const GRID: Record<Region, { column: number; row: number }> = {
  top: { column: 2, row: 1 },
  left: { column: 1, row: 2 },
  centre: { column: 2, row: 2 },
  right: { column: 3, row: 2 },
  bottom: { column: 2, row: 3 },
}

export interface ToothInspectorProps {
  fdi: number
  /** Findings already on this tooth, for the history column (and for what may be charted next, see tooth-rules). */
  history: OdontogramEvent[]
  busy?: boolean
  /** Density only. `chair` enlarges every target for a gloved finger. */
  variant?: 'desk' | 'chair'
  onClose: () => void
  /** `onSaved` runs only once the server has accepted the entry. */
  onChart: (input: { code: string; surfaces: Surface[]; notes?: string }, onSaved: () => void) => void
  onSupersede: (
    input: {
      replaces: number
      kind: 'correction' | 'entered-in-error'
      reason: string
      code?: string
      surfaces?: Surface[]
    },
    onSaved: () => void,
  ) => void
}

export function ToothInspector({
  fdi,
  history,
  busy = false,
  variant = 'desk',
  onClose,
  onChart,
  onSupersede,
}: ToothInspectorProps) {
  const [code, setCode] = useState<string>('')
  const [surfaces, setSurfaces] = useState<Surface[]>([])
  const [typed, setTyped] = useState('')
  const [notes, setNotes] = useState('')
  const [retracting, setRetracting] = useState<OdontogramEvent | null>(null)
  const dockRef = useRef<HTMLDivElement>(null)

  const byRegion = useMemo(() => regionsBySurface(fdi), [fdi])
  const available = useMemo(() => surfacesOf(fdi), [fdi])
  const whole = isWholeTooth(code)

  // A new tooth gets a fresh panel (ToothChart keys it by tooth), so no selection carries over.

  // On a short screen the panel can open below the fold; scroll to it only if needed.
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    dockRef.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
  }, [fdi])


  const toggle = (surface: Surface) =>
    setSurfaces((current) =>
      current.includes(surface)
        ? current.filter((s) => s !== surface)
        : available.filter((s) => s === surface || current.includes(s)),
    )

  const applyTyped = (value: string) => {
    setTyped(value)
    setSurfaces(parseSurfaceCode(fdi, value))
  }

  // What the tooth is (missing, an implant, a denture…) limits what may be charted next.
  const current = toothFoundation(history)
  const ruleNote = toothRuleNote(fdi, current)
  const ready = Boolean(code) && isAllowedOn(current, code) && (whole || surfaces.length > 0)
  const chosen = conditionFor(code)

  // The form is cleared only once the save goes through, so a failed save keeps what was entered.
  const commit = () => {
    onChart({ code, surfaces, notes: notes.trim() || undefined }, () => {
      setCode('')
      setSurfaces([])
      setTyped('')
      setNotes('')
    })
  }

  // The header says exactly what the button will chart, which catches a mis-tap.
  const readout = !chosen
    ? 'Pick a finding below'
    : whole
      ? `${chosen.label} — whole tooth`
      : surfaces.length === 0
        ? `${chosen.label} — choose one or more surfaces`
        : `${chosen.label} — ${surfaceCode(fdi, surfaces)}`

  return (
    <div
      ref={dockRef}
      className="odontogram od-dock"
      data-variant={variant}
      role="region"
      aria-label={`Chart ${toothName(fdi)}`}
    >
      {/* ─── Which tooth, and what is about to be recorded ──────────────── */}
      <header className="od-dock-head">
        <span className="od-dock-badge" aria-hidden="true">
          {fdi}
        </span>
        <div className="min-w-0 flex-1">
          <p className="od-dock-title">{toothName(fdi)}</p>
          <p className="od-dock-readout" aria-live="polite" data-ready={ready}>
            {readout}
          </p>
        </div>
        <button type="button" onClick={onClose} className="od-dock-close" aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="od-dock-body">
        {/* ─── What is being charted ───────────────────────────────────── */}
        <section className="od-dock-col od-col-finding">
          <p className="od-col-label">Finding</p>
          {ruleNote && (
            <p className="od-rule-note" role="note">
              {ruleNote} If that finding is wrong, mark it entered in error in the history below.
            </p>
          )}

          <div className="od-groups">
            {(['condition', 'restoration', 'surgery'] as ConditionGroup[]).map((group) => (
              <div key={group}>
                <p className="od-group-label">{GROUP_LABELS[group]}</p>
                <div className="od-chips">
                  {conditionsInGroup(group).map((def) => {
                    const on = code === def.code
                    const allowed = isAllowedOn(current, def.code)
                    return (
                      <button
                        key={def.code}
                        type="button"
                        disabled={!allowed}
                        onClick={() => {
                          setCode(on ? '' : def.code)
                          // A whole-tooth finding has no surfaces, and the API refuses them.
                          if (!on && isWholeTooth(def.code)) setSurfaces([])
                        }}
                        className="od-chip"
                        data-on={on}
                        aria-pressed={on}
                        style={{
                          border: `1px solid ${on ? `var(--od-${def.tone})` : 'var(--color-border)'}`,
                          background: on ? `var(--od-${def.tone})` : 'var(--color-surface)',
                          color: on ? '#FFFFFF' : 'var(--color-foreground)',
                        }}
                        title={allowed ? def.hint : (ruleNote ?? undefined)}
                      >
                        <span className="od-chip-code">{def.short}</span>
                        {def.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Surfaces ────────────────────────────────────────────────── */}
        <section className="od-dock-col od-col-surfaces">
          <div className="flex items-center justify-between gap-2">
            <p className="od-col-label">Surfaces</p>
            {!whole && (
              <input
                value={typed}
                onChange={(e) => applyTyped(e.target.value)}
                placeholder="MOD"
                aria-label="Type a surface code"
                className="od-code-input"
              />
            )}
          </div>

          {whole ? (
            <p className="od-whole-note">
              {chosen?.label} is charted on the whole tooth, so it takes no surfaces.
            </p>
          ) : (
            <>
              <div className="od-cross">
                {(Object.keys(GRID) as Region[]).map((region) => {
                  const surface = Object.entries(byRegion).find(([, r]) => r === region)?.[0] as
                    | Surface
                    | undefined
                  if (!surface) return null

                  const on = surfaces.includes(surface)
                  return (
                    <button
                      key={region}
                      type="button"
                      className="od-cross-cell"
                      data-on={on}
                      style={{ gridColumn: GRID[region].column, gridRow: GRID[region].row }}
                      onClick={() => toggle(surface)}
                      aria-pressed={on}
                    >
                      <span className="od-cross-letter">{surface}</span>
                      <span className="od-cross-name">{surfaceName(fdi, surface)}</span>
                    </button>
                  )
                })}
              </div>

              {/* The resolved code: `MOD` on an incisor comes back `MID`. */}
              <p className="od-surface-code" data-empty={surfaces.length === 0}>
                {surfaces.length > 0 ? surfaceCode(fdi, surfaces) : 'None selected'}
              </p>
            </>
          )}
        </section>

        {/* ─── This tooth's history ────────────────────────────────────── */}
        <section className="od-dock-col od-col-history">
          <p className="od-col-label">
            <History size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 5 }} />
            History
          </p>
          <ToothHistoryPanel
            key={retracting?.id ?? 'none'}
            fdi={fdi}
            history={history}
            retracting={retracting}
            onRetract={setRetracting}
            onSupersede={onSupersede}
            busy={busy}
          />
        </section>
      </div>

      {/* ─── Commit ──────────────────────────────────────────────────────── */}
      <footer className="od-dock-foot">
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && ready && !busy) commit()
          }}
          placeholder="Note (optional)"
          className="od-dock-note"
        />
        <button
          type="button"
          disabled={!ready || busy}
          onClick={commit}
          className="btn-gradient od-dock-commit"
        >
          <Check size={15} />
          {busy ? 'Charting…' : ready ? `Chart ${chosen?.label}` : 'Pick a finding'}
        </button>
      </footer>
    </div>
  )
}

/**
 * Everything ever charted on this tooth, newest first. Corrected and withdrawn
 * entries stay on the list, struck through, with why: the chart drops them,
 * the record keeps them. The list scrolls so the Chart button stays in view.
 */
function ToothHistoryPanel({
  fdi,
  history,
  retracting,
  onRetract,
  onSupersede,
  busy,
}: {
  fdi: number
  history: OdontogramEvent[]
  retracting: OdontogramEvent | null
  onRetract: (event: OdontogramEvent | null) => void
  onSupersede: ToothInspectorProps['onSupersede']
  busy: boolean
}) {
  // Reset per retraction by `key` at the call site, not by an effect.
  const [reason, setReason] = useState('')

  if (history.length === 0) {
    return (
      <p className="od-history-empty">Nothing charted on tooth {fdi} yet.</p>
    )
  }

  return (
    <div className="od-history">
      <ul className="od-history-list">
        {history.map((event, i) => {
          const def = conditionFor(event.condition_code)
          const withdrawn = event.status === 'entered-in-error'
          const replaced = event.status === 'corrected' || event.status === 'amended'
          const isTombstone = event.supersession_type === 'entered-in-error'

          return (
            <li
              key={event.id}
              className="od-finding od-history-item"
              style={{ ['--od-delay' as string]: `${i * 30}ms` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="text-sm"
                  style={{
                    color:
                      withdrawn || replaced
                        ? 'var(--color-subtle-foreground)'
                        : 'var(--color-foreground)',
                    textDecoration: withdrawn ? 'line-through' : undefined,
                  }}
                >
                  {isTombstone
                    ? 'Withdrew an earlier finding'
                    : `${def?.label ?? event.condition_code ?? 'Charted'}${
                        event.surfaces?.length ? ` ${event.surfaces.join('')}` : ''
                      }`}
                </span>
                <span
                  className="shrink-0 text-[10px] font-mono"
                  style={{ color: 'var(--color-subtle-foreground)' }}
                >
                  {event.observed_at.slice(0, 10)}
                </span>
              </div>

              {/* Why it stopped being true, which is the part a reader needs. */}
              {(withdrawn || replaced) && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-warning)' }}>
                  {withdrawn ? 'Entered in error' : 'Corrected'}
                  {event.superseded_by_event_ids.length > 0 &&
                    ` — see entry ${event.superseded_by_event_ids.join(', ')}`}
                </p>
              )}
              {event.supersession_reason && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                  {event.supersession_reason}
                </p>
              )}
              {event.notes && (
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
                  {event.notes}
                </p>
              )}

              {/* Only an entry that still stands can be withdrawn. */}
              {!withdrawn && !replaced && !isTombstone && (
                <button type="button" onClick={() => onRetract(event)} className="od-retract-open">
                  Mark entered in error
                </button>
              )}
            </li>
          )
        })}
      </ul>

      {retracting && (
        <div className="od-retract">
          <p className="flex items-start gap-1.5 text-xs">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              This does not delete the entry. It stays in the record, marked as entered in error,
              with the reason you give below.
            </span>
          </p>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why was this entered in error?"
            className="od-retract-input"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!reason.trim() || busy}
              onClick={() => {
                // Closed only once withdrawn, so a failed save keeps the reason typed.
                onSupersede(
                  {
                    replaces: retracting.id,
                    kind: 'entered-in-error',
                    reason: reason.trim(),
                  },
                  () => onRetract(null),
                )
              }}
              className="od-retract-confirm"
            >
              Withdraw entry
            </button>
            <button type="button" onClick={() => onRetract(null)} className="od-retract-cancel">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

