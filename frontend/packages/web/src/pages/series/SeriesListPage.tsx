import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { seriesApi, type SeriesDetail } from "@/api/series.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import type { PluginName } from "@/types/index.ts";

const PLUGINS: PluginName[] = ["ebook", "music", "video", "game", "pic", "online_viewer"];

export function SeriesListPage() {
  const qc = useQueryClient();
  const [selectedPlugin, setSelectedPlugin] = useState<PluginName | "">("");
  const [newName, setNewName] = useState("");
  const [newPlugin, setNewPlugin] = useState<PluginName>("ebook");
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data: allSeries, isLoading } = useQuery({
    queryKey: ["series", selectedPlugin],
    queryFn: () => seriesApi.list(selectedPlugin || undefined),
  });

  const { data: detail } = useQuery({
    queryKey: ["series-detail", expanded],
    queryFn: () => seriesApi.get(expanded!),
    enabled: expanded != null,
  });

  const create = useMutation({
    mutationFn: () => seriesApi.create(newName.trim(), newPlugin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["series"] });
      setNewName("");
    },
  });

  const removeResource = useMutation({
    mutationFn: ({ seriesId, resourceId }: { seriesId: number; resourceId: number }) =>
      seriesApi.removeResource(seriesId, resourceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["series-detail", expanded] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Series</h1>
      </div>

      {/* Create form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-6 flex gap-3 items-end">
        <Input
          label="New Series Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="My Series"
          className="w-48"
        />
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400">Plugin</label>
          <select
            value={newPlugin}
            onChange={(e) => setNewPlugin(e.target.value as PluginName)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
          >
            {PLUGINS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <Button
          onClick={() => create.mutate()}
          disabled={!newName.trim() || create.isPending}
        >
          + Create
        </Button>
      </div>

      {/* Plugin filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {[{ label: "All", value: "" }, ...PLUGINS.map((p) => ({ label: p, value: p }))].map(
          ({ label, value }) => (
            <button
              key={value}
              onClick={() => setSelectedPlugin(value as PluginName | "")}
              className={[
                "px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors",
                selectedPlugin === value
                  ? "bg-purple-700 text-white"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200",
              ].join(" ")}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <div className="flex flex-col gap-2">
          {allSeries?.map((s) => (
            <div key={s.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-800/30"
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
              >
                <span className="text-gray-200 font-medium">{s.name}</span>
                <span className="text-xs text-gray-500">{s.plugin} · {expanded === s.id ? "▲" : "▼"}</span>
              </button>

              {expanded === s.id && detail && (
                <div className="border-t border-gray-800 px-5 py-3">
                  {(detail as SeriesDetail).resources.length === 0 ? (
                    <p className="text-xs text-gray-600">No resources in this series yet.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {(detail as SeriesDetail).resources.map((r) => (
                        <li key={r.id} className="flex items-center justify-between text-sm">
                          <Link
                            to={`/resources/${r.plugin}/${r.id}`}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            {r.name}
                          </Link>
                          <button
                            onClick={() => removeResource.mutate({ seriesId: s.id, resourceId: r.id })}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ))}
          {!allSeries?.length && (
            <p className="text-gray-600 text-sm">No series yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
