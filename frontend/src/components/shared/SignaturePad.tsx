'use client'

import { useEffect, useRef, useState } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'
import type SignatureCanvas from 'react-signature-canvas'
import { PenLine, Trash2 } from 'lucide-react'

interface SignaturePadProps {
  /** Called with a base64 PNG data URI when the user confirms the signature */
  onSave: (dataUrl: string) => void
}

/**
 * Touch-optimised signature capture using react-signature-canvas.
 * Works with a finger, stylus or mouse.
 * The "Save" button is disabled until the canvas has at least one stroke.
 */
export function SignaturePad({ onSave }: SignaturePadProps) {
  const padRef = useRef<SignatureCanvas>(null)
  const [isEmpty, setIsEmpty] = useState(true)

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
    if (padRef.current && !padRef.current.isEmpty()) setIsEmpty(false)
  }

  function handleClear() {
    padRef.current?.clear()
    setIsEmpty(true)
  }

  function handleSave() {
    if (!padRef.current || padRef.current.isEmpty()) return
    onSave(padRef.current.toDataURL('image/png'))
  }

  return (
    <div className="card-premium overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <PenLine size={17} style={{ color: 'var(--color-primary)' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-foreground)' }}>
          Patient Signature
        </h3>
        <span className="ml-auto text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          Sign in the box below
        </span>
      </div>

      {/* Canvas */}
      <div className="relative" style={{ background: '#FAFBFC', borderBottom: '1px solid var(--color-border)' }}>
        <ReactSignatureCanvas
          ref={padRef}
          penColor="#0F172A"
          clearOnResize={false}
          canvasProps={{
            style: { width: '100%', height: 200, display: 'block', cursor: 'crosshair' },
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
      </div>

      {/* Actions. type="button": this pad sits inside the intake <form>, where a
          bare <button> is a submit — pressing Clear or Save would send the form. */}
      <div className="flex items-center justify-between px-5 py-3">
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 transition-colors hover:bg-slate-100"
          style={{ color: 'var(--color-muted-foreground)', border: '1px solid var(--color-border)' }}
          aria-label="Clear signature"
        >
          <Trash2 size={13} /> Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isEmpty}
          className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Save signature"
        >
          Save Signature
        </button>
      </div>
    </div>
  )
}
