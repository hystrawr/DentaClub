"use client";

import { type ReactNode, useEffect, useEffectEvent, useRef, useState } from "react";
import { errorMessages } from "@/lib/api/client";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/* ─── Dialog ────────────────────────────────────────────────────── */

/**
 * A modal form. The first field is focused on open; server errors are listed
 * above the buttons. The backdrop does not close it, so a misclick loses
 * nothing: Cancel and Escape do, asking first in an in-app dialog when the
 * form is `dirty`.
 */
export function FormDialog({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = "Save",
  submitting,
  disabled,
  error,
  dirty,
  discardTitle = "Discard your changes?",
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitting?: boolean;
  disabled?: boolean;
  error?: unknown;
  /** Something was typed that closing would lose. */
  dirty?: boolean;
  discardTitle?: string;
  children: ReactNode;
}) {
  const firstField = useRef<HTMLDivElement>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  function cancel() {
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  }

  // Always the latest cancel, without making the effect below re-run. Callers
  // usually pass a new onClose every render — with it as a dependency, each
  // keystroke re-ran the effect and yanked focus back to the first field.
  const close = useEffectEvent(cancel);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    firstField.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)" }} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="card-premium w-full max-w-md pointer-events-auto"
          style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        >
          <div className="px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
              {title}
            </h2>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Only the fields scroll; the title above and the buttons below stay put. */}
            <div ref={firstField} className="modal-body px-5 py-4 space-y-4">
              {children}
              <FormError error={error} />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
              <button type="button" onClick={cancel} disabled={submitting} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={submitting || disabled} className="btn btn-primary">
                {submitting ? "Saving…" : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDiscard}
        title={discardTitle}
        message="Nothing has been saved. Everything typed so far will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        danger
        onConfirm={() => {
          setConfirmingDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmingDiscard(false)}
      />
    </>
  );
}

export function FormError({ error }: { error: unknown }) {
  const messages = errorMessages(error);
  if (messages.length === 0) return null;
  return (
    <ul className="space-y-1" role="alert">
      {messages.map((message) => (
        <li key={message} className="text-xs" style={{ color: "var(--color-destructive)" }}>
          {message}
        </li>
      ))}
    </ul>
  );
}

/* ─── Fields ────────────────────────────────────────────────────── */

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1" style={{ color: "var(--color-foreground)" }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="text-xs mt-1 block leading-relaxed" style={{ color: "var(--color-muted-foreground)" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

const CONTROL_CLASS = "w-full h-9 rounded-lg px-3 text-sm outline-none transition-shadow field-focus";

const controlStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--color-foreground)",
} as const;

export function TextField(props: React.ComponentProps<"input">) {
  return <input {...props} className={CONTROL_CLASS} style={controlStyle} />;
}

export function SelectField(props: React.ComponentProps<"select">) {
  return <select {...props} className={CONTROL_CLASS} style={controlStyle} />;
}

export function TextAreaField(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow field-focus"
      style={{ ...controlStyle, minHeight: 72, resize: "vertical" }}
    />
  );
}
