"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * An in-app replacement for `window.confirm`: a small dialog above everything
 * else, with the safe choice focused so Enter does not destroy anything.
 * Escape and the backdrop both cancel.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-60" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onCancel} aria-hidden="true" />
      <div className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby={message ? "confirm-dialog-message" : undefined}
          className="pointer-events-auto w-full max-w-sm rounded-2xl p-5 shadow-xl"
          style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
        >
          <div className="flex items-start gap-3">
            <span
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: 36,
                height: 36,
                background: danger ? "var(--color-destructive-light)" : "var(--color-surface-subtle)",
                color: danger ? "var(--color-destructive)" : "var(--color-muted-foreground)",
              }}
              aria-hidden="true"
            >
              <AlertTriangle size={18} />
            </span>
            <div className="min-w-0">
              <h2 id="confirm-dialog-title" className="text-[15px] font-semibold" style={{ color: "var(--color-foreground)" }}>
                {title}
              </h2>
              {message && (
                <p id="confirm-dialog-message" className="mt-1 text-sm" style={{ color: "var(--color-muted-foreground)" }}>
                  {message}
                </p>
              )}
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="button" className={danger ? "btn btn-danger" : "btn btn-primary"} onClick={onConfirm}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
