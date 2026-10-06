"use client";

import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { errorMessages } from "@/lib/api/client";

// Form primitives, ported from DentalOS components/frontdesk/settings/primitives.tsx.

/* ─── Dialog ────────────────────────────────────────────────────── */

/**
 * A modal form. Escape and the backdrop close it; the first field is focused
 * on open; server errors are listed above the buttons.
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
  children: ReactNode;
}) {
  const firstField = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    firstField.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="card-premium w-full max-w-md pointer-events-auto"
          style={{ maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        >
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
              {title}
            </h2>
            <button onClick={onClose} className="btn-ghost p-1 rounded-md" aria-label="Close" type="button">
              <X size={16} />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="flex-1 overflow-y-auto"
          >
            <div ref={firstField} className="px-5 py-4 space-y-4">
              {children}
              <FormError error={error} />
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 shrink-0" style={{ borderTop: "1px solid var(--color-border)" }}>
              <button type="button" onClick={onClose} className="btn-ghost px-3 py-2 text-sm rounded-lg">
                Cancel
              </button>
              <button type="submit" disabled={submitting || disabled} className="btn-gradient px-4 py-2 text-sm font-semibold">
                {submitting ? "Saving…" : submitLabel}
              </button>
            </div>
          </form>
        </div>
      </div>
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
