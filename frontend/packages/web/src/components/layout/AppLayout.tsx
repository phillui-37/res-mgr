import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";
import { IdentityGate } from "./IdentityGate.tsx";

const isElectron = typeof window !== "undefined" && !!window.electron;
// Height of the drag region that replaces the hidden native title bar.
const TITLE_BAR_HEIGHT = 36;

export function AppLayout() {
  return (
    <IdentityGate>
      {isElectron && (
        <div
          style={{
            height: TITLE_BAR_HEIGHT,
            // @ts-expect-error webkit-app-region is not in CSSProperties
            WebkitAppRegion: "drag",
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
          }}
        />
      )}
      <div
        className="flex h-screen overflow-hidden"
        style={isElectron ? { paddingTop: TITLE_BAR_HEIGHT } : undefined}
      >
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-gray-950 p-6">
          <Outlet />
        </main>
      </div>
    </IdentityGate>
  );
}
