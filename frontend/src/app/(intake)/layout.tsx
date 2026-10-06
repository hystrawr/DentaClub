import { Activity } from "lucide-react";

/**
 * The patient-facing shell (from DentalOS's intake layout): a minimal clinic
 * header and one centred column sized for a phone.
 */
export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--color-canvas)" }}>
      <header
        className="flex items-center justify-center py-4"
        style={{ borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 32, height: 32, background: "linear-gradient(135deg, #2563EB 0%, #0D9488 100%)" }}
            aria-hidden="true"
          >
            <Activity size={15} color="#fff" strokeWidth={2} />
          </div>
          <span className="text-sm font-bold" style={{ color: "var(--color-foreground)" }}>
            DentaClub Patient Forms
          </span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center py-8 px-4">
        <div className="w-full" style={{ maxWidth: 520 }}>
          {children}
        </div>
      </main>

      <footer className="py-4 text-center text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
        Secure patient forms · This link is private to you and works once
      </footer>
    </div>
  );
}
