import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout.tsx";
import { DashboardPage } from "@/pages/DashboardPage.tsx";
import { ResourceListPage } from "@/pages/resources/ResourceListPage.tsx";
import { ResourceDetailPage } from "@/pages/resources/ResourceDetailPage.tsx";
import { ResourceFormPage } from "@/pages/resources/ResourceFormPage.tsx";
import { P2PRoomsPage } from "@/pages/p2p/P2PRoomsPage.tsx";
import { P2PRoomDetailPage } from "@/pages/p2p/P2PRoomDetailPage.tsx";
import { SettingsPage } from "@/pages/settings/SettingsPage.tsx";

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="resources" element={<ResourceListPage />} />
        <Route path="resources/new" element={<ResourceFormPage />} />
        <Route path="resources/:plugin/:id" element={<ResourceDetailPage />} />
        <Route path="p2p" element={<P2PRoomsPage />} />
        <Route path="p2p/:roomId" element={<P2PRoomDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
