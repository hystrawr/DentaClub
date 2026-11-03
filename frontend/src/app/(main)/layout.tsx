import { AppHeader } from "@/components/layout/AppHeader";
import { Sidebar } from "@/components/layout/Sidebar";
import { SignInGate } from "@/components/layout/SignInGate";

/**
 * Front-desk shell, behind the sign-in: the header on top, the navigation (a
 * floating rail, or a bottom bar on a phone) and a scrollable main area.
 *
 * Side margins: 20px on a phone, 40px from 640px, 48px from 1024px (each page's
 * `px-5 sm:px-10 lg:px-12`). The rail floats 24px in from the left; the main
 * area starts 24px past it, so the page's own margin is the gap after the rail.
 */
export default function FrontDeskLayout({ children }: LayoutProps<"/">) {
  return (
    <SignInGate>
      <div className="flex flex-col h-dvh overflow-hidden" style={{ background: "var(--color-canvas)" }}>
        <AppHeader />
        <Sidebar />
        {/* Room for the floating rail (desktop) or the bottom bar (phone), so neither covers content. */}
        <main className="app-main flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </SignInGate>
  );
}
