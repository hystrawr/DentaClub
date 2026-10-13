'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

import { CONDITIONS, GROUP_LABELS, STATUS_STYLES, type ConditionGroup } from '@/lib/odontogram/conditions'

/**
 * The legend, grouped as the PDA chart groups it.
 *
 * Worth the space: the two-letter codes are what make the chart readable
 * without colour, and they are only self-explanatory to someone who already
 * knows the paper form. Collapsible, because once you know it you never need it
 * again — and chairside, screen space is the scarce thing.
 *
 * The status row is the second axis and the one people miss: a planned finding
 * is the *same hue* as an existing one and differs by a dashed outline. Saying
 * so once here saves explaining it.
 */
export function ChartLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="odontogram">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 pb-2"
        aria-expanded={open}
      >
        <span
          className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-subtle-foreground)' }}
        >
          <Info size={12} /> Legend
        </span>
        <ChevronDown
          size={14}
          style={{
            color: 'var(--color-muted-foreground)',
            transform: open ? 'rotate(180deg)' : undefined,
            transition: 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      </button>

      {/* Closed, the legend still prints: the chart is read on paper too. */}
      <div className={`od-sheet pb-2 space-y-4 ${open ? '' : 'hidden print:block'}`}>
        <div
          className="grid gap-4 pt-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          {(['condition', 'restoration', 'surgery'] as ConditionGroup[]).map((group) => (
            <div key={group}>
              <p
                className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-subtle-foreground)' }}
              >
                {GROUP_LABELS[group]}
              </p>
              <ul className="space-y-1">
                {CONDITIONS.filter((c) => c.group === group).map((def) => (
                  <li key={def.code} className="flex items-center gap-2">
                    <span
                      className="shrink-0 rounded"
                      style={{
                        width: 14,
                        height: 14,
                        background: `var(--od-${def.tone})`,
                        opacity: def.pattern === 'outline' ? 0.2 : 1,
                        border: `1px solid var(--od-${def.tone})`,
                      }}
                      aria-hidden="true"
                    />
                    <span
                      className="font-mono text-[10px] w-6 shrink-0"
                      style={{ color: 'var(--color-subtle-foreground)' }}
                    >
                      {def.short}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--color-foreground)' }}>
                      {def.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} className="pt-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-subtle-foreground)' }}
          >
            Status — the outline, not the colour
          </p>
          <div className="flex flex-wrap gap-3">
            {(['existing', 'planned', 'completed'] as const).map((status) => (
              <span key={status} className="flex items-center gap-1.5">
                <span
                  className="shrink-0 rounded"
                  style={{
                    width: 14,
                    height: 14,
                    background: 'var(--od-metal)',
                    opacity: STATUS_STYLES[status].fill,
                    border: `${STATUS_STYLES[status].strokeWidth}px ${
                      STATUS_STYLES[status].dashed ? 'dashed' : 'solid'
                    } var(--od-metal)`,
                  }}
                  aria-hidden="true"
                />
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {STATUS_STYLES[status].label}
                </span>
              </span>
            ))}
          </div>
          <p className="text-[11px] mt-2 leading-relaxed" style={{ color: 'var(--color-subtle-foreground)' }}>
            A planned filling is the same colour as a finished one, so accepting a plan does not
            change the tooth&rsquo;s colour in front of the patient. Every finding also carries its
            code, so the chart still reads in black and white.
          </p>
        </div>
      </div>
    </div>
  )
}
