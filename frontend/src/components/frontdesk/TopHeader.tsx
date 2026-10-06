"use client";

import { Plus } from "lucide-react";
import { PatientSearch } from "./PatientSearch";

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  /** Rendered only when `onCta` is given too — a button that does nothing is worse than none. */
  ctaLabel?: string;
  onCta?: () => void;
}

/** The shell header (from DentalOS): page title, the real patient search, and one optional CTA. */
export function TopHeader({ title, subtitle, ctaLabel, onCta }: TopHeaderProps) {
  return (
    <header
      className="flex items-center gap-4 px-6 shrink-0"
      style={{
        height: "var(--header-height)",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
      }}
    >
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold truncate" style={{ color: "var(--color-foreground)", lineHeight: 1.3 }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
            {subtitle}
          </p>
        )}
      </div>

      <PatientSearch className="w-60 shrink-0" placeholder="Search patients…" />

      {onCta && ctaLabel && (
        <button className="btn btn-primary" onClick={onCta} aria-label={ctaLabel}>
          <Plus size={15} strokeWidth={2.5} />
          {ctaLabel}
        </button>
      )}
    </header>
  );
}
