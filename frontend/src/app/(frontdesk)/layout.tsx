import { AppHeader } from "@/components/frontdesk/AppHeader";
import { Sidebar } from "@/components/frontdesk/Sidebar";
import { SignInGate } from "@/components/frontdesk/SignInGate";

/** Front-desk shell: app header on top, a floating sidebar over a scrollable main area, behind the sign-in. */
export default function FrontDeskLayout({ children }: LayoutProps<"/">) {
  return (
    <SignInGate>
      <div className="flex flex-col h-screen overflow-hidden" style={{ background: "var(--color-canvas)" }}>
        <AppHeader />
        <Sidebar />
        {/* Gutter for the rail so it never covers content. */}
        <main className="flex-1 min-w-0 overflow-y-auto" style={{ paddingLeft: "calc(var(--rail-width) + 32px)" }}>
          {children}
        </main>
      </div>
    </SignInGate>
  );
}
