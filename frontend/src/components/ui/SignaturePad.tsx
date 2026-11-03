'use client'

import { useEffect, useRef, useState } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'
import type SignatureCanvas from 'react-signature-canvas'
import { Trash2 } from 'lucide-react'

interface SignaturePadProps {
  /** A base64 PNG data URI after each stroke, or null once cleared. */
  onChange: (dataUrl: string | null) => void
  disabled?: boolean
}

/**
 * Touch-optimised signature capture using react-signature-canvas.
 * Works with a finger, stylus or mouse.
 */
export function SignaturePad({ onChange, disabled = false }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    if (disabled) padRef.current?.off()
    else padRef.current?.on()
  }, [disabled])

  /**
   * Keep the strokes when the window resizes.
   *
   * The library's default (`clearOnResize`) wipes the pad on *any* window
   * resize — and on a phone that is constant: the address bar collapsing as
   * the patient scrolls, the keyboard closing, a rotation. A patient would
   * watch their signature vanish mid-signing. Instead the canvas is resized
   * only when its width really changed, and the strokes are redrawn into it.
   */
  useEffect(() => {
    function onResize() {
      const pad = padRef.current
      if (!pad) return
      const canvas = pad.getCanvas()
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      const width = canvas.offsetWidth * ratio
      const height = canvas.offsetHeight * ratio
      if (canvas.width === width && canvas.height === height) return
      const strokes = pad.toData()
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')?.scale(ratio, ratio)
      pad.clear()
      pad.fromData(strokes)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function handleEnd() {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) return
    setIsEmpty(false)
    onChange(pad.toDataURL('image/png'))
  }

  function handleClear() {
    padRef.current?.clear()
    setIsEmpty(true)
    onChange(null)
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
      {/* Canvas */}
      <div className="relative" style={{ background: '#FAFBFC', borderBottom: '1px solid var(--color-border)' }}>
        <ReactSignatureCanvas
          ref={padRef}
          penColor="#0F172A"
          clearOnResize={false}
          canvasProps={{
            style: { width: '100%', height: 200, display: 'block', cursor: disabled ? 'default' : 'crosshair' },
            'aria-label': 'Signature canvas — draw your signature here',
          }}
          onEnd={handleEnd}
        />
        {/* Baseline guide */}
        <div
          className="absolute bottom-10 left-8 right-8 pointer-events-none"
          style={{ borderBottom: '1.5px dashed var(--color-border)' }}
          aria-hidden="true"
        />
        {isEmpty && (
          <span
            className="absolute left-0 right-0 bottom-3 text-center text-xs pointer-events-none"
            style={{ color: 'var(--color-subtle-foreground)' }}
            aria-hidden="true"
          >
            Sign above the line with a finger, stylus or mouse
          </span>
        )}
      </div>

      <div className="flex items-center justify-end px-3 py-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={isEmpty || disabled}
          className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 transition-colors hover:bg-[var(--color-surface-subtle)] disabled:opacity-40 disabled:pointer-events-none"
          style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
          aria-label="Clear signature"
        >
          <Trash2 size={13} /> Clear
        </button>
      </div>
    </div>
  )
}
