import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { resourcesApi } from "@/api/index.ts";
import { useResourceStore } from "@/store/resources.ts";
import { Badge } from "@/components/ui/Badge.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import type { PluginName } from "@/types/index.ts";

const PLUGIN_COLORS: Record<PluginName, "purple" | "blue" | "green" | "yellow" | "red"> = {
  ebook: "purple",
  music: "blue",
  video: "green",
  game: "red",
  pic: "yellow",
  online_viewer: "blue",
};

const PLUGIN_TABS: Array<{ label: string; value: PluginName | "" }> = [
  { label: "All", value: "" },
  { label: "Ebook", value: "ebook" },
  { label: "Music", value: "music" },
  { label: "Video", value: "video" },
  { label: "Game", value: "game" },
  { label: "Pic", value: "pic" },
  { label: "Online Viewer", value: "online_viewer" },
];

export function ResourceListPage() {
  const { filter, setFilter } = useResourceStore();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["resources", filter],
    queryFn: () => resourcesApi.list(filter),
  });

  const totalPages = data ? Math.ceil(data.total / (filter.per_page ?? 50)) : 1;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Resources</h1>
        <Link to="/resources/new">
          <Button>+ Add Resource</Button>
        </Link>
      </div>

      {/* Plugin filter tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {PLUGIN_TABS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter({ plugin: value as PluginName | undefined, page: 1 })}
            className={[
              "px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors",
              filter.plugin === value || (!filter.plugin && value === "")
                ? "bg-purple-700 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFilter({ name: e.target.value || undefined, page: 1 });
          }}
        />
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-2">{data?.total} resources</div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Plugin</th>
                  <th className="px-4 py-3">Locations</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((r) => (
                  <tr key={r.id} className="border-b border-gray-800/60 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-gray-200 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      <Badge
                        label={r.plugin}
                        color={PLUGIN_COLORS[r.plugin] ?? "gray"}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.locations?.length ?? 0} location(s)
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/resources/${r.plugin}/${r.id}`}
                        className="text-purple-400 hover:text-purple-300 text-xs"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
                {!data?.data.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No resources found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex gap-2 mt-4 justify-end items-center">
              <Button
                variant="ghost"
                size="sm"
                disabled={(filter.page ?? 1) <= 1}
                onClick={() => setFilter({ page: (filter.page ?? 1) - 1 })}
              >
                ← Prev
              </Button>
              <span className="text-sm text-gray-400">
                Page {filter.page ?? 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={(filter.page ?? 1) >= totalPages}
                onClick={() => setFilter({ page: (filter.page ?? 1) + 1 })}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
