import { Sidebar } from "@/components/frontdesk/Sidebar";

/** Front-desk shell (from DentalOS): fixed sidebar, scrollable main area. */
export default function FrontDeskLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--color-canvas)" }}>
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
