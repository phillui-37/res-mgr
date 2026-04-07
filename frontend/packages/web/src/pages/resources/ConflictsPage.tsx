import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { resourcesApi } from "@/api/index.ts";
import { Badge } from "@/components/ui/Badge.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import type { DuplicateGroup, Resource, PluginName } from "@/types/index.ts";

const PLUGIN_COLORS: Record<PluginName, "purple" | "blue" | "green" | "yellow" | "red"> = {
  ebook: "purple",
  music: "blue",
  video: "green",
  game: "red",
  pic: "yellow",
  online_viewer: "blue",
};

function ResourceRow({
  resource,
  onKeep,
  onDelete,
  isKeeping,
  isDeleting,
}: {
  resource: Resource;
  onKeep: () => void;
  onDelete: () => void;
  isKeeping: boolean;
  isDeleting: boolean;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <tr className="border-b border-gray-800/60 last:border-0">
      <td className="px-4 py-3">
        <button
          className="text-gray-200 font-medium hover:text-purple-300 text-left"
          onClick={() => navigate(`/resources/${resource.plugin}/${resource.id}`)}
        >
          {resource.name}
        </button>
      </td>
      <td className="px-4 py-3">
        <Badge label={resource.plugin} color={PLUGIN_COLORS[resource.plugin] ?? "gray"} />
      </td>
      <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">
        {resource.locations?.[0]
          ? <><span className="text-purple-400 font-medium">{resource.locations[0].device}</span>{": "}{resource.locations[0].path}</>
          : t("common.unknown")}
        {resource.locations?.length > 1 && (
          <span className="ml-1 text-gray-500">+{resource.locations.length - 1}</span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-500 text-xs">
        {new Date(resource.updated_at).toLocaleDateString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onKeep} disabled={isKeeping || isDeleting}>
            {isKeeping ? t("conflicts.keeping") : t("conflicts.keepOnly")}
          </Button>
          <Button size="sm" variant="danger" onClick={onDelete} disabled={isKeeping || isDeleting}>
            {isDeleting ? t("conflicts.deleting") : t("conflicts.delete")}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function DuplicateGroupCard({ group, onResolved }: { group: DuplicateGroup; onResolved: () => void }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Record<number, "keeping" | "deleting">>({});

  const deleteMutation = useMutation({
    mutationFn: (id: number) => resourcesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources", "duplicates"] });
      onResolved();
    },
  });

  async function handleKeepOnly(keepId: number) {
    const others = group.resources.filter((r) => r.id !== keepId);
    setBusy(Object.fromEntries(others.map((r) => [r.id, "deleting" as const])));
    setBusy((b) => ({ ...b, [keepId]: "keeping" }));
    for (const r of others) {
      await deleteMutation.mutateAsync(r.id);
    }
    setBusy({});
  }

  async function handleDelete(id: number) {
    setBusy((b) => ({ ...b, [id]: "deleting" }));
    await deleteMutation.mutateAsync(id);
    setBusy({});
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden mb-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-gray-800/40">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">
            {group.count} duplicates
          </span>
          <code className="text-xs text-gray-500 font-mono">
            {group.checksum.slice(0, 16)}…
          </code>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left text-gray-500">
            <th className="px-4 py-2 text-xs">{t("conflicts.columns.name")}</th>
            <th className="px-4 py-2 text-xs">{t("conflicts.columns.plugin")}</th>
            <th className="px-4 py-2 text-xs">{t("conflicts.columns.location")}</th>
            <th className="px-4 py-2 text-xs">{t("conflicts.columns.updated")}</th>
            <th className="px-4 py-2 text-xs">{t("conflicts.columns.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {group.resources.map((r) => (
            <ResourceRow
              key={r.id}
              resource={r}
              onKeep={() => handleKeepOnly(r.id)}
              onDelete={() => handleDelete(r.id)}
              isKeeping={busy[r.id] === "keeping"}
              isDeleting={busy[r.id] === "deleting"}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConflictsPage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const { data: groups, isLoading } = useQuery({
    queryKey: ["resources", "duplicates"],
    queryFn: () => resourcesApi.duplicates(),
  });

  function handleResolved() {
    queryClient.invalidateQueries({ queryKey: ["resources", "duplicates"] });
  }

  const activeGroups = groups ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">{t("conflicts.title")}</h1>
          <p className="text-sm text-gray-400 mt-1">{t("conflicts.subtitle")}</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["resources", "duplicates"] })}
        >
          ↻ Refresh
        </Button>
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : activeGroups.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-12 text-center">
          <div className="text-4xl mb-3">✓</div>
          <div className="text-gray-300 font-medium mb-1">{t("conflicts.noConflicts")}</div>
          <div className="text-sm text-gray-500">{t("conflicts.noConflictsHint")}</div>
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-4">
            {t("conflicts.count", { count: activeGroups.length })}
          </div>
          {activeGroups.map((group) => (
            <DuplicateGroupCard
              key={group.checksum}
              group={group}
              onResolved={handleResolved}
            />
          ))}
        </>
      )}
    </div>
  );
}
