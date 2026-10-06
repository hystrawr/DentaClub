'use client'

import { useState } from 'react'
import { ScrollText } from 'lucide-react'

interface ConsentViewerProps {
  /** HTML string from the consent template */
  html: string
  /** Called when the patient checks the agreement checkbox */
  onAgree: (agreed: boolean) => void
  agreed: boolean
}

/**
 * Displays a scrollable consent document with a sticky "I agree" checkbox.
 * The checkbox is required before the intake flow can proceed.
 */
export function ConsentViewer({ html, onAgree, agreed }: ConsentViewerProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false)

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget
    const atBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 32
    if (atBottom) setScrolledToBottom(true)
  }

  return (
    <div className="card-premium overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-5 py-4"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        <ScrollText size={17} style={{ color: 'var(--color-primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
          Consent Form
        </h3>
      </div>

      {/* Scrollable content */}
      <div
        className="overflow-y-auto px-5 py-4 text-sm leading-relaxed"
        style={{
          maxHeight: 280,
          color: 'var(--color-foreground)',
          borderBottom: '1px solid var(--color-border)',
        }}
        onScroll={handleScroll}
        tabIndex={0}
        aria-label="Consent document — scroll to read"
        // Render trusted HTML from the server-validated consent template
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {/* Scroll hint */}
      {!scrolledToBottom && (
        <div
          className="px-5 py-2 text-xs text-center"
          style={{ color: 'var(--color-subtle-foreground)', borderBottom: '1px solid var(--color-border)' }}
        >
          Scroll to read the full consent ↓
        </div>
      )}

      {/* Agreement checkbox — sticky at bottom */}
      <div className="px-5 py-4">
        <label
          className="flex items-start gap-3 cursor-pointer"
          htmlFor="consent-agree"
        >
          <input
            id="consent-agree"
            type="checkbox"
            checked={agreed}
            onChange={(e) => onAgree(e.target.checked)}
            className="mt-0.5 shrink-0"
            style={{ width: 18, height: 18, accentColor: 'var(--color-primary)' }}
            aria-describedby="consent-agree-label"
          />
          <span
            id="consent-agree-label"
            className="text-sm leading-snug"
            style={{ color: 'var(--color-foreground)' }}
          >
            I have read and understood the above consent, and I agree to its terms.
          </span>
        </label>
      </div>
    </div>
  )
}
