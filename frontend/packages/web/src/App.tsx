import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout.tsx";
import { DashboardPage } from "@/pages/DashboardPage.tsx";
import { ResourceListPage } from "@/pages/resources/ResourceListPage.tsx";
import { ResourceDetailPage } from "@/pages/resources/ResourceDetailPage.tsx";
import { ResourceFormPage } from "@/pages/resources/ResourceFormPage.tsx";
import { BatchImportPage } from "@/pages/resources/BatchImportPage.tsx";
import { BatchEditPage } from "@/pages/resources/BatchEditPage.tsx";
import { ConflictsPage } from "@/pages/resources/ConflictsPage.tsx";
import { P2PRoomsPage } from "@/pages/p2p/P2PRoomsPage.tsx";
import { P2PRoomDetailPage } from "@/pages/p2p/P2PRoomDetailPage.tsx";
import { SettingsPage } from "@/pages/settings/SettingsPage.tsx";
import { SeriesListPage } from "@/pages/series/SeriesListPage.tsx";

export function App() {
  // Prevent Electron from navigating to dropped files at the document level.
  // Component-level drop zones call preventDefault() themselves; this catches
  // anything that lands outside a designated zone.
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="resources" element={<ResourceListPage />} />
        <Route path="resources/new" element={<ResourceFormPage />} />
        <Route path="resources/batch" element={<BatchImportPage />} />
        <Route path="resources/batch-edit" element={<BatchEditPage />} />
        <Route path="resources/conflicts" element={<ConflictsPage />} />
        <Route path="resources/:plugin/:id" element={<ResourceDetailPage />} />
        <Route path="series" element={<SeriesListPage />} />
        <Route path="p2p" element={<P2PRoomsPage />} />
        <Route path="p2p/:roomId" element={<P2PRoomDetailPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
