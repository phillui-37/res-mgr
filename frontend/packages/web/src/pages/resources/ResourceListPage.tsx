import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { resourcesApi } from "@/api/index.ts";
import { useResourceStore, ALLOWED_PER_PAGE, type PerPage } from "@/store/resources.ts";
import { Badge } from "@/components/ui/Badge.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import { MetaFilterBuilder, conditionsToParams, type MetaCondition } from "@/components/resource/MetaFilterBuilder.tsx";
import type { PluginName } from "@/types/index.ts";

const PLUGIN_COLORS: Record<PluginName, "purple" | "blue" | "green" | "yellow" | "red"> = {
  ebook: "purple",
  music: "blue",
  video: "green",
  game: "red",
  pic: "yellow",
  online_viewer: "blue",
};

export function ResourceListPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { filter, setFilter, setPerPage } = useResourceStore();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [langInput, setLangInput] = useState("");
  const [metaConds, setMetaConds] = useState<MetaCondition[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  async function editSelected() {
    navigate("/resources/batch-edit", { state: { ids: [...selected] } });
  }

  const PLUGIN_TABS: Array<{ label: string; value: PluginName | "" }> = [
    { label: t("resources.tabs.all"), value: "" },
    { label: t("resources.tabs.ebook"), value: "ebook" },
    { label: t("resources.tabs.music"), value: "music" },
    { label: t("resources.tabs.video"), value: "video" },
    { label: t("resources.tabs.game"), value: "game" },
    { label: t("resources.tabs.pic"), value: "pic" },
    { label: t("resources.tabs.online_viewer"), value: "online_viewer" },
  ];

  const activeFilter = {
    ...filter,
    meta_cond: conditionsToParams(metaConds),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["resources", activeFilter],
    queryFn: () => resourcesApi.list(activeFilter),
  });

  const totalPages = data ? Math.ceil(data.total / (filter.per_page ?? 50)) : 1;

  const rows = data?.data ?? [];
  const pageIds = rows.map((r) => r.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected((s) => { const n = new Set(s); pageIds.forEach((id) => n.delete(id)); return n; });
    } else {
      setSelected((s) => new Set([...s, ...pageIds]));
    }
  }

  function toggleOne(id: number) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function deleteSelected() {
    if (!window.confirm(t("resources.confirmBatchDelete", { count: selected.size }))) return;
    setDeleting(true);
    await resourcesApi.bulkRemove([...selected]);
    setSelected(new Set());
    setDeleting(false);
    void qc.invalidateQueries({ queryKey: ["resources"] });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">{t("resources.title")}</h1>
        <div className="flex gap-2">
          {someSelected && (
            <>
              <Button
                variant="secondary"
                onClick={editSelected}
              >
                {t("resources.batchEdit", { count: selected.size })}
              </Button>
              <Button
                variant="danger"
                onClick={deleteSelected}
                disabled={deleting}
              >
                {deleting
                  ? t("resources.batchDeleting")
                  : t("resources.batchDelete", { count: selected.size })}
              </Button>
            </>
          )}
          <Link to="/resources/new">
            <Button>{t("resources.addResource")}</Button>
          </Link>
        </div>
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

      {/* Search + Language filter */}
      <div className="mb-3 flex gap-2 max-w-xl flex-wrap">
        <Input
          placeholder={t("resources.filter.searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setFilter({ name: e.target.value || undefined, page: 1 });
          }}
        />
        <Input
          placeholder={t("resources.filter.languagePlaceholder")}
          value={langInput}
          data-testid="language-filter-input"
          onChange={(e) => setLangInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setFilter({ language: langInput || undefined, page: 1 });
            }
          }}
        />
        {filter.language && (
          <button
            data-testid="active-language-filter"
            onClick={() => { setLangInput(""); setFilter({ language: undefined, page: 1 }); }}
            className="whitespace-nowrap text-xs px-2 py-1 bg-blue-900/60 text-blue-300 rounded-lg hover:bg-blue-800/60"
          >
            {filter.language} ×
          </button>
        )}
      </div>

      {/* Metadata condition builder */}
      <div className="mb-4 max-w-2xl">
        <MetaFilterBuilder
          conditions={metaConds}
          onChange={(conds) => { setMetaConds(conds); setFilter({ page: 1 }); }}
        />
      </div>

      {isLoading ? (
        <LoadingScreen />
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-2">{t("resources.count", { count: data?.total ?? 0 })}</div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left text-gray-500">
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="accent-purple-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">{t("resources.columns.name")}</th>
                  <th className="px-4 py-3">{t("resources.columns.plugin")}</th>
                  <th className="px-4 py-3">{t("resources.columns.language")}</th>
                  <th className="px-4 py-3">{t("resources.columns.locations")}</th>
                  <th className="px-4 py-3">{t("resources.columns.updated")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-800/60 hover:bg-gray-800/40 cursor-pointer"
                    onClick={() => navigate(`/resources/${r.plugin}/${r.id}`)}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => { e.stopPropagation(); toggleOne(r.id); }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        className="accent-purple-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-200 font-medium">{r.name}</td>
                    <td className="px-4 py-3">
                      <Badge label={r.plugin} color={PLUGIN_COLORS[r.plugin] ?? "gray"} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.language ?? t("common.unknown")}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {t("resources.locationCount", { count: r.locations?.length ?? 0 })}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      {t("resources.noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination + page size */}
          <div className="flex gap-2 mt-4 justify-end items-center">
            <label className="text-xs text-gray-500 flex items-center gap-1">
              {t("resources.pagination.perPage")}
              <select
                value={filter.per_page ?? 50}
                onChange={(e) => setPerPage(Number(e.target.value) as PerPage)}
                className="ml-1 bg-gray-800 border border-gray-700 text-gray-300 text-xs rounded px-1.5 py-0.5 focus:outline-none focus:border-purple-500"
              >
                {ALLOWED_PER_PAGE.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            {totalPages > 1 && (
              <>
                <Button variant="ghost" size="sm" disabled={(filter.page ?? 1) <= 1} onClick={() => setFilter({ page: (filter.page ?? 1) - 1 })}>
                  {t("resources.pagination.prev")}
                </Button>
                <span className="text-sm text-gray-400">
                  {t("resources.pagination.page", { current: filter.page ?? 1, total: totalPages })}
                </span>
                <Button variant="ghost" size="sm" disabled={(filter.page ?? 1) >= totalPages} onClick={() => setFilter({ page: (filter.page ?? 1) + 1 })}>
                  {t("resources.pagination.next")}
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

