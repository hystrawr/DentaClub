'use client'

/**
 * The chart, in words.
 *
 * The highest-value, lowest-cost thing on the screen. It reads aloud, it pastes
 * into a clinical note, a screen reader gets it without any extra work, and it
 * catches a mis-tap immediately — a clinician who charted tooth 26 instead of 16
 * sees the wrong number in a sentence long before they would spot it in a grid
 * of thirty-two boxes.
 */
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
    <div className="odontogram card-premium px-5 py-4">
      <p
        className="text-[10px] font-semibold uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-subtle-foreground)' }}
      >
        Findings
      </p>

      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-foreground)' }}>
        {toothCount === 0 ? (
          // Not an empty state — a mouth with nothing charted is a valid, sound
          // mouth, and saying "no data" about a healthy patient is wrong.
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
