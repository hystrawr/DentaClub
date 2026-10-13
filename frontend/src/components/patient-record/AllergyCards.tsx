"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { ALLERGENS, allergiesOnFile } from "@/lib/utils/medical-history";
import type { MedicalHistoryAnswers } from "@/types/api";

/**
 * Item 8, "Are you allergic to any of the following?". A ticked card is an
 * allergy on file; "Others" opens a box to name it. The red badge counts them,
 * because this is the answer the dentist must not miss.
 */
export function AllergyCards({
  answers,
  onChange,
}: {
  answers: MedicalHistoryAnswers;
  onChange: (patch: Partial<MedicalHistoryAnswers>) => void;
}) {
  const [othersOpen, setOthersOpen] = useState(Boolean(answers.other_allergies));
  const showOthers = othersOpen || Boolean(answers.other_allergies);
  const count = allergiesOnFile(answers).length;

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-start gap-2" style={{ color: "var(--color-destructive)" }}>
          <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">8. Are you allergic to any of the following?</p>
            <p className="text-xs opacity-80">Shown to the dentist before every procedure</p>
          </div>
        </div>
        {count > 0 && (
          <span className="text-[11px] font-semibold rounded-full px-2.5 py-1 text-white" style={{ background: "var(--color-destructive)" }}>
            {count} {count === 1 ? "allergy" : "allergies"} on file
          </span>
        )}
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
        {ALLERGENS.map((a) => {
          const on = answers[a.key] === true;
          return (
            <button key={a.key} type="button" className="record-allergen" aria-pressed={on} onClick={() => onChange({ [a.key]: on ? false : true })}>
              <span>{a.label}</span>
              <Mark on={on} />
            </button>
          );
        })}
        <button
          type="button"
          className="record-allergen"
          aria-pressed={showOthers}
          onClick={() => {
            if (showOthers) {
              setOthersOpen(false);
              onChange({ other_allergies: null });
            } else setOthersOpen(true);
          }}
        >
          <span>Others</span>
          <Mark on={showOthers} />
        </button>
      </div>

      {showOthers && (
        <label className="block mt-2.5">
          <span className="record-label block mb-1.5">
            Other allergies
          </span>
          <input
            className="record-input"
            value={answers.other_allergies ?? ""}
            onChange={(e) => onChange({ other_allergies: e.target.value || null })}
            maxLength={1000}
            autoFocus={othersOpen && !answers.other_allergies}
          />
        </label>
      )}
    </div>
  );
}

function Mark({ on }: { on: boolean }) {
  return (
    <span
      className="flex items-center justify-center rounded-full shrink-0"
      style={{ width: 16, height: 16, border: `1.5px solid ${on ? "#fff" : "var(--color-border-strong)"}` }}
      aria-hidden="true"
    >
      {on && <Check size={10} strokeWidth={3} />}
    </span>
  );
}
