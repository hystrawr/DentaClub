'use client'

import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'

import { CONDITIONS, GROUP_LABELS, type ConditionGroup } from '@/lib/odontogram/conditions'

/** The legend, grouped as on the PDA chart. */
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
          className="flex items-center gap-1.5 text-xs font-medium"
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
                className="text-xs font-medium mb-1.5"
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
                        // Outline findings are drawn faint on the tooth, so the swatch is too.
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
      </div>
    </div>
  )
}
