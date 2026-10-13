"use client";

/**
 * Yes / No. Nothing pressed means not answered yet, which is not the same as
 * "No" — so pressing the chosen answer again clears it back to unanswered.
 */
export function YesNoToggle({
  value,
  onChange,
  label,
}: {
  value: boolean | null;
  onChange: (value: boolean | null) => void;
  /** The question, for screen readers. */
  label: string;
}) {
  return (
    <div className="record-seg" role="group" aria-label={label}>
      {[true, false].map((answer) => (
        <button
          key={String(answer)}
          type="button"
          aria-pressed={value === answer}
          onClick={() => onChange(value === answer ? null : answer)}
        >
          {answer ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

/** One of several answers (e.g. Low / Moderate / Severe); pressing it again clears it. */
export function ChoiceToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  severe,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T | null;
  onChange: (value: T | null) => void;
  label: string;
  /** The answer to colour red when chosen. */
  severe?: T;
}) {
  return (
    <div className="record-seg" role="group" aria-label={label} style={{ height: 38 }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          data-severe={o.value === severe ? "" : undefined}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
