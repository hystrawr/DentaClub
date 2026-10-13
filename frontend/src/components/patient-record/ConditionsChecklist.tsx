"use client";

import { CONDITIONS } from "@/lib/utils/medical-history";

/** Section 13: tick every condition the patient has or has had. */
export function ConditionsChecklist({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  const ticked = new Set(value);

  return (
    <div style={{ columns: "3 220px", columnGap: 24 }}>
      {CONDITIONS.map((c) => (
        <label key={c.code} className="record-check flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] cursor-pointer" style={{ breakInside: "avoid" }}>
          <input
            type="checkbox"
            checked={ticked.has(c.code)}
            onChange={(e) => onChange(e.target.checked ? [...value, c.code] : value.filter((code) => code !== c.code))}
            className="shrink-0"
            style={{ width: 16, height: 16, accentColor: "var(--color-primary)" }}
          />
          {c.label}
        </label>
      ))}
    </div>
  );
}
