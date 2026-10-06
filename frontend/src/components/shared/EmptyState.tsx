import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/** Empty-state placeholder for list views (from DentalOS). Every list renders this when it has no rows. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6" role="status" aria-label={title}>
      <div
        className="flex items-center justify-center rounded-2xl mb-4"
        style={{
          width: 64,
          height: 64,
          background: "var(--color-surface-subtle)",
          border: "1px solid var(--color-border)",
        }}
        aria-hidden="true"
      >
        <Icon size={28} style={{ color: "var(--color-subtle-foreground)" }} strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--color-foreground)" }}>
        {title}
      </p>
      {description && (
        <p className="text-xs max-w-xs leading-relaxed mb-4" style={{ color: "var(--color-muted-foreground)" }}>
          {description}
        </p>
      )}
      {action && <div>{action}</div>}
    </div>
  );
}
