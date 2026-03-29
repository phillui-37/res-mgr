import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.tsx";

export function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-950 p-6">
        <Outlet />
      </main>
    </div>
  );
}
