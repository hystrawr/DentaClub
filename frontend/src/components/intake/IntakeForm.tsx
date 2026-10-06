'use client'

import { useState, type ReactNode } from 'react'

import { ConsentViewer } from './ConsentViewer'
import { SignaturePad } from '@/components/shared/SignaturePad'
import type { IntakeFieldSchema } from '@/types/api'

/* ─── Field schema ──────────────────────────────────────────────── */

type FieldSchema = IntakeFieldSchema

/**
 * One step of a patient's intake packet.
 *
 * ## Controlled, and why that changed
 *
 * This used to hold the answers itself. That works for one screen and breaks the
 * moment there are several: the page has to accumulate answers across steps to
 * post the packet in one call, it has to put a server's 422 back on the field
 * that caused it, and it has to pre-fill from what the clinic already knows —
 * none of which it can do to state locked inside a child that remounts on every
 * step change. So values and errors come from above now; what stays here is the
 * rendering and the required-field check that runs before a step advances.
 *
 * ## The field types that were missing
 *
 * The seeded Medical History template uses `checkboxes` (plural — a multi-select
 * with options) and `boolean` (a yes/no question). Neither existed in the old
 * union or in the old switch, so both fell through to `return null` and rendered
 * as nothing: a patient saw a step with a heading and no questions on it.
 *
 * `checkbox` singular is a different control again, and the distinction is the
 * one `intake-sections.ts` draws on the server. A `checkbox` with no options is
 * a single consent tick — "I consent to the proposed treatment" — where `false`
 * is a refusal and not an answer. A `boolean` is a question — "Are you
 * pregnant?" — where `false` is a complete answer. They look alike in the schema
 * and are opposite in meaning, so they get opposite controls: a tick box that
 * must be ticked, and a Yes/No pair either of which counts as answered.
 */

interface IntakeFormProps {
  fields:       FieldSchema[]
  values:       Record<string, unknown>
  onChange:     (key: string, value: unknown) => void
  onSubmit:     () => void
  /** Server-side messages, keyed by field key. Merged over local validation. */
  serverErrors?: Record<string, string>
  submitLabel?: string
  isSubmitting?: boolean
  /** Rendered under the submit button — the Back control, usually. */
  footer?:      ReactNode
}

/* ─── Presentation ──────────────────────────────────────────────── */

function FieldLabel({ id, label, required }: { id: string; label: string; required?: boolean }) {
  return (
    <label htmlFor={id} className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--color-foreground)' }}>
      {label}
      {required && <span className="ml-1" style={{ color: 'var(--color-destructive)' }} aria-hidden="true">*</span>}
    </label>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs font-medium" role="alert" style={{ color: 'var(--color-destructive)' }}>
      {message}
    </p>
  )
}

/** 16px minimum: anything smaller makes iOS Safari zoom the viewport on focus. */
function inputBase(invalid: boolean, extra?: React.CSSProperties): React.CSSProperties {
  return {
    width:        '100%',
    minHeight:    48,
    padding:      '12px 14px',
    borderRadius: 12,
    border:       `1px solid ${invalid ? 'var(--color-destructive)' : 'var(--color-border)'}`,
    background:   'var(--color-surface)',
    color:        'var(--color-foreground)',
    fontSize:     16,
    outline:      'none',
    ...extra,
  }
}

/** A tappable row for a choice. 48px minimum — a thumb, not a mouse. */
function choiceRow(selected: boolean): React.CSSProperties {
  return {
    minHeight:    48,
    padding:      '10px 12px',
    borderRadius: 12,
    border:       `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
    background:   selected ? 'var(--color-primary-light)' : 'var(--color-surface)',
  }
}

/* ─── Answered-ness ─────────────────────────────────────────────── */

/**
 * Whether a required field has an answer.
 *
 * Mirrors `isAnswered` in `apps/api/src/intake/intake-sections.ts`, including
 * the `checkbox`/`boolean` split, so the client refuses exactly what the server
 * would refuse.
 *
 * With one deliberate addition: **`signature` is checked here even though the
 * server skips it.** The server skips it because a signature never arrives in
 * `responses` — it comes separately, on `POST /:token/sign`. The client is the
 * one place that holds both, and it has to check, because without it a patient
 * can press Submit on an unsigned consent packet and get a thank-you screen: the
 * answers save, the sign call is skipped, `completedAt` stays null, and the
 * clinic ends up with an open link and no signed consent while the patient
 * believes they are done.
 */
function isAnswered(field: FieldSchema, value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (field.type === 'checkbox') return value === true
  if (typeof value === 'string')  return value.trim() !== ''
  if (Array.isArray(value))       return value.length > 0
  return true
}

/* ─── Main component ────────────────────────────────────────────── */

export function IntakeForm({
  fields, values, onChange, onSubmit, serverErrors, submitLabel = 'Continue', isSubmitting = false, footer,
}: IntakeFormProps) {
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({})

  const errors: Record<string, string> = { ...localErrors, ...serverErrors }

  function set(key: string, value: unknown) {
    onChange(key, value)
    if (localErrors[key]) {
      setLocalErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const next: Record<string, string> = {}
    for (const field of fields) {
      if (!field.required || field.type === 'consent_html') continue
      if (!isAnswered(field, values[field.key])) {
        next[field.key] =
          field.type === 'checkbox'  ? 'Please tick this to continue.'
          : field.type === 'signature' ? 'Please sign above, then press Save.'
          : `${field.label} is required.`
      }
    }

    setLocalErrors(next)
    if (Object.keys(next).length === 0) onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {fields.map((field, index) => {
        // Two templates may share a field key (both consents use `acknowledge`),
        // so the React key needs the position too, or React drops one of them.
        const rowKey   = `${index}:${field.key}`
        const value    = values[field.key]
        const error    = errors[field.key]
        const errorId  = `${field.key}-error`
        const invalid  = Boolean(error)

        const aria = {
          'aria-required':    field.required,
          'aria-invalid':     invalid,
          'aria-describedby': invalid ? errorId : undefined,
        }

        switch (field.type) {
          /* ── Free text ───────────────────────────────────────── */
          case 'textarea':
            return (
              <div key={rowKey}>
                <FieldLabel id={field.key} label={field.label} required={field.required} />
                <textarea
                  id={field.key}
                  {...aria}
                  rows={3}
                  value={(value as string) ?? ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  style={inputBase(invalid, { resize: 'vertical' })}
                />
                <FieldError id={errorId} message={error} />
              </div>
            )

          case 'text':
          case 'number':
          case 'tel':
          case 'email':
          case 'date':
            return (
              <div key={rowKey}>
                <FieldLabel id={field.key} label={field.label} required={field.required} />
                <input
                  id={field.key}
                  {...aria}
                  type={field.type === 'number' ? 'number' : field.type}
                  inputMode={field.type === 'tel' ? 'tel' : field.type === 'number' ? 'numeric' : undefined}
                  value={(value as string) ?? ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  style={inputBase(invalid)}
                />
                <FieldError id={errorId} message={error} />
              </div>
            )

          /* ── One of several ──────────────────────────────────── */
          case 'radio':
          case 'select':
            return (
              <fieldset key={rowKey} className="border-0 p-0 m-0" {...aria}>
                <legend className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
                  {field.label}
                  {field.required && <span className="ml-1" style={{ color: 'var(--color-destructive)' }} aria-hidden="true">*</span>}
                </legend>
                <div className="flex flex-col gap-2">
                  {field.options?.map((option) => (
                    <label key={option} className="flex items-center gap-3 cursor-pointer" style={choiceRow(value === option)}>
                      <input
                        type="radio"
                        name={field.key}
                        value={option}
                        checked={value === option}
                        onChange={() => set(field.key, option)}
                        style={{ width: 20, height: 20, accentColor: 'var(--color-primary)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--color-foreground)' }}>{option}</span>
                    </label>
                  ))}
                </div>
                <FieldError id={errorId} message={error} />
              </fieldset>
            )

          /*
            A yes/no question. Rendered as two radios rather than one tick,
            because "not ticked" and "No" are different claims and a medical
            history that cannot tell them apart is worse than one that asks
            twice. `false` is a complete answer here.
          */
          case 'boolean':
            return (
              <fieldset key={rowKey} className="border-0 p-0 m-0" {...aria}>
                <legend className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
                  {field.label}
                  {field.required && <span className="ml-1" style={{ color: 'var(--color-destructive)' }} aria-hidden="true">*</span>}
                </legend>
                <div className="flex gap-2">
                  {[{ label: 'Yes', v: true }, { label: 'No', v: false }].map((option) => (
                    <label
                      key={option.label}
                      className="flex flex-1 items-center justify-center gap-2 cursor-pointer"
                      style={choiceRow(value === option.v)}
                    >
                      <input
                        type="radio"
                        name={field.key}
                        checked={value === option.v}
                        onChange={() => set(field.key, option.v)}
                        className="sr-only"
                      />
                      <span
                        className="text-sm font-semibold"
                        style={{ color: value === option.v ? 'var(--color-primary-hover)' : 'var(--color-foreground)' }}
                      >
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
                <FieldError id={errorId} message={error} />
              </fieldset>
            )

          /* ── Several of several ──────────────────────────────── */
          case 'checkboxes':
            return (
              <fieldset key={rowKey} className="border-0 p-0 m-0" {...aria}>
                <legend className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>
                  {field.label}
                  {field.required && <span className="ml-1" style={{ color: 'var(--color-destructive)' }} aria-hidden="true">*</span>}
                </legend>
                <div className="flex flex-col gap-2">
                  {field.options?.map((option) => {
                    const list    = Array.isArray(value) ? (value as string[]) : []
                    const checked = list.includes(option)
                    return (
                      <label key={option} className="flex items-center gap-3 cursor-pointer" style={choiceRow(checked)}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            set(field.key, checked ? list.filter((v) => v !== option) : [...list, option])
                          }
                          style={{ width: 20, height: 20, accentColor: 'var(--color-primary)' }}
                        />
                        <span className="text-sm" style={{ color: 'var(--color-foreground)' }}>{option}</span>
                      </label>
                    )
                  })}
                </div>
                <FieldError id={errorId} message={error} />
              </fieldset>
            )

          /*
            The consent tick. A single box with no options — which is exactly
            what the seeded Treatment Consent and Data Privacy templates declare,
            and exactly what the old renderer could not draw: it mapped over
            `field.options`, found none, and produced a label with no control
            beside it. The patient was shown a required consent they had no way
            to give.
          */
          case 'checkbox':
            return (
              <div key={rowKey}>
                <label
                  htmlFor={field.key}
                  className="flex items-start gap-3 cursor-pointer"
                  style={choiceRow(value === true)}
                >
                  <input
                    id={field.key}
                    {...aria}
                    type="checkbox"
                    checked={value === true}
                    onChange={(e) => set(field.key, e.target.checked)}
                    className="mt-0.5 shrink-0"
                    style={{ width: 20, height: 20, accentColor: 'var(--color-primary)' }}
                  />
                  <span className="text-sm leading-snug" style={{ color: 'var(--color-foreground)' }}>
                    {field.label}
                    {field.required && <span className="ml-1" style={{ color: 'var(--color-destructive)' }} aria-hidden="true">*</span>}
                  </span>
                </label>
                <FieldError id={errorId} message={error} />
              </div>
            )

          /* ── Documents and signing ───────────────────────────── */
          case 'signature':
            return (
              <div key={rowKey}>
                <SignaturePad onSave={(dataUrl) => set(field.key, dataUrl)} />
                {value ? (
                  <p className="mt-1.5 text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                    Signature captured.
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs" style={{ color: 'var(--color-subtle-foreground)' }}>
                    Draw your signature above, then press Save.
                  </p>
                )}
                <FieldError id={errorId} message={error} />
              </div>
            )

          case 'consent_html':
            return (
              <div key={rowKey}>
                <ConsentViewer
                  html={field.html ?? ''}
                  agreed={(value as boolean) ?? false}
                  onAgree={(agreed) => set(field.key, agreed)}
                />
                <FieldError id={errorId} message={error} />
              </div>
            )

          /*
            `fieldsSchema` is JSONB — a clinic can put a type in it that this
            build has never heard of. A text input is the answer that loses the
            least: the question is still asked, the answer is still recorded, and
            it beats both a blank space and a crash.
          */
          default:
            return (
              <div key={rowKey}>
                <FieldLabel id={field.key} label={field.label} required={field.required} />
                <input
                  id={field.key}
                  {...aria}
                  type="text"
                  value={(value as string) ?? ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  style={inputBase(invalid)}
                />
                <FieldError id={errorId} message={error} />
              </div>
            )
        }
      })}

      <div className="space-y-2 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-gradient w-full flex items-center justify-center font-semibold disabled:opacity-45 disabled:pointer-events-none"
          style={{ minHeight: 52, borderRadius: 16, fontSize: 16 }}
        >
          {isSubmitting ? 'Saving…' : submitLabel}
        </button>
        {footer}
      </div>
    </form>
  )
}
