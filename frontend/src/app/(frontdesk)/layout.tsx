import { Sidebar } from "@/components/frontdesk/Sidebar";
import { SignInGate } from "@/components/frontdesk/SignInGate";

/** Front-desk shell (from DentalOS): fixed sidebar, scrollable main area, behind the sign-in. */
export default function FrontDeskLayout({ children }: LayoutProps<"/">) {
  return (
    <SignInGate>
      <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-canvas)" }}>
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SignInGate>
  );
}
