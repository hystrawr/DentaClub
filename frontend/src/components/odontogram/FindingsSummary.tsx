'use client'

/** The chart in words, which also catches a finding charted on the wrong tooth. */
export function FindingsSummary({
  lines,
  toothCount,
  missingCount,
}: {
  lines: string[]
  toothCount: number
  missingCount: number
}) {
  return (
    <div className="odontogram">
      <p
        className="text-xs font-medium mb-2"
        style={{ color: 'var(--color-subtle-foreground)' }}
      >
        Findings
      </p>

      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-foreground)' }}>
        {toothCount === 0 ? (
          // Nothing charted means a sound mouth, not missing data.
          <>Nothing charted yet. Every tooth is recorded as sound.</>
        ) : (
          <>
            {toothCount} {toothCount === 1 ? 'tooth' : 'teeth'} charted
            {missingCount > 0 && `, ${missingCount} missing`}.
          </>
        )}
      </p>

      {lines.length > 0 && (
        <ul className="mt-2 space-y-1">
          {lines.map((line, i) => (
            <li
              key={line}
              className="od-finding text-sm"
              style={{
                ['--od-delay' as string]: `${i * 40}ms`,
                color: 'var(--color-muted-foreground)',
              }}
            >
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
