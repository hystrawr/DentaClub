"use client";

import { useState } from "react";

/**
 * Reset and Delete. Reset throws away unsaved edits; Delete asks first, in
 * place — the question replaces the buttons until it is answered.
 */
export function ResetDelete({
  onReset,
  resetDisabled,
  onDelete,
  confirmText,
  deleting,
}: {
  onReset: () => void;
  resetDisabled?: boolean;
  onDelete: () => void;
  /** The question asked before deleting, e.g. "Delete this patient and every record?" */
  confirmText: string;
  deleting?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming || deleting) {
    return (
      <div className="flex items-center gap-2 flex-wrap" role="alert">
        <span className="text-xs font-medium" style={{ color: "var(--color-destructive)" }}>
          {confirmText}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirming(false)} disabled={deleting}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={deleting}
          onClick={() => {
            onDelete();
            setConfirming(false);
          }}
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onReset} disabled={resetDisabled}>
        Reset
      </button>
      <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--color-destructive)" }} onClick={() => setConfirming(true)}>
        Delete
      </button>
    </>
  );
}

/**
 * The bar under a form: the tab's own tools (Reset, Delete) on the left,
 * then what is unsaved and the button that saves it.
 */
export function SaveBar({
  dirty,
  saving,
  disabled,
  error,
  tools,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  disabled?: boolean;
  error?: React.ReactNode;
  tools?: React.ReactNode;
  onSave: () => void;
}) {
  return (
    <div
      className="sticky bottom-0 mt-auto flex items-center justify-end gap-3 px-5 py-3 flex-wrap"
      style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", borderRadius: "0 0 var(--radius-xl) var(--radius-xl)" }}
      data-print="hide"
    >
      {tools && <div className="flex items-center gap-2 flex-wrap">{tools}</div>}
      <div className="mr-auto min-w-0 text-xs">{error}</div>
      <span className="text-xs font-semibold" style={{ color: dirty ? "var(--color-warning)" : "var(--color-muted-foreground)" }}>
        {dirty ? "Unsaved changes" : "All changes saved"}
      </span>
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty || saving || disabled}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}
