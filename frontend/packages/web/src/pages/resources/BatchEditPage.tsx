import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { resourcesApi } from "@/api/index.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { LoadingScreen } from "@/components/ui/Spinner.tsx";
import type { PluginName, ResourceLocation } from "@/types/index.ts";

const PLUGINS: PluginName[] = ["ebook", "music", "video", "game", "pic", "online_viewer"];

type EditDraft = {
  id: number;
  name: string;
  plugin: PluginName;
  language: string;
  tags: string; // comma-separated for editing
  active: boolean;
  // expandable metadata
  checksum: string;
  locations: ResourceLocation[];
};

export function BatchEditPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const ids: number[] = location.state?.ids ?? [];

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ["resource", id],
      queryFn: () => resourcesApi.get(id),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const resources = results.map((r) => r.data).filter(Boolean);

  const [drafts, setDrafts] = useState<EditDraft[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && resources.length > 0 && drafts.length === 0) {
      setDrafts(
        resources.map((r) => ({
          id: r!.id,
          name: r!.name,
          plugin: r!.plugin,
          language: r!.language ?? "",
          tags: (r!.tags ?? []).join(", "),
          active: r!.active,
          checksum: r!.checksum ?? "",
          locations: r!.locations ?? [],
        }))
      );
    }
  }, [isLoading, resources.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateDraft(id: number, field: keyof EditDraft, value: string | boolean | ResourceLocation[]) {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /** Copy all editable fields from the given draft to every other draft. */
  function copyToAll(sourceId: number) {
    const source = drafts.find((d) => d.id === sourceId);
    if (!source) return;
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === sourceId
          ? d
          : {
              ...d,
              name: source.name,
              plugin: source.plugin,
              language: source.language,
              tags: source.tags,
              active: source.active,
              checksum: source.checksum,
              locations: source.locations.map((l) => ({ ...l })),
            }
      )
    );
  }

  function updateLocation(draftId: number, idx: number, field: keyof ResourceLocation, value: string) {
    setDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== draftId) return d;
        const locs = d.locations.map((l, i) => (i === idx ? { ...l, [field]: value } : l));
        return { ...d, locations: locs };
      })
    );
  }

  function addLocation(draftId: number) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? { ...d, locations: [...d.locations, { device: "", path: "" }] }
          : d
      )
    );
  }

  function removeLocation(draftId: number, idx: number) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? { ...d, locations: d.locations.filter((_, i) => i !== idx) }
          : d
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await resourcesApi.bulkUpdate(
        drafts.map((d) => ({
          id: d.id,
          name: d.name,
          plugin: d.plugin,
          language: d.language || undefined,
          tags: d.tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          active: d.active,
          checksum: d.checksum || undefined,
          locations: d.locations.filter((l) => l.path.trim()),
        }))
      );
      void qc.invalidateQueries({ queryKey: ["resources"] });
      navigate("/resources");
    } catch (err) {
      setError((err as Error)?.message ?? t("batchEdit.error"));
    } finally {
      setSaving(false);
    }
  }

  if (!ids.length) {
    navigate("/resources");
    return null;
  }

  if (isLoading || drafts.length === 0) return <LoadingScreen />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-100">
          {t("batchEdit.title", { count: drafts.length })}
        </h1>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("batchEdit.saving") : t("batchEdit.save")}
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            {t("batchEdit.cancel")}
          </Button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-gray-500">
              <th className="px-4 py-3 w-8" />
              <th className="px-4 py-3">{t("batchEdit.columns.name")}</th>
              <th className="px-4 py-3">{t("batchEdit.columns.plugin")}</th>
              <th className="px-4 py-3">{t("batchEdit.columns.language")}</th>
              <th className="px-4 py-3">{t("batchEdit.columns.tags")}</th>
              <th className="px-4 py-3 text-center">{t("batchEdit.columns.active")}</th>
              <th className="px-4 py-3 w-28" />
            </tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <>
                <tr key={d.id} className="border-b border-gray-800/60">
                  {/* expand toggle */}
                  <td className="px-3 py-2 text-center">
                    <button
                      title={t("batchEdit.toggleMeta")}
                      onClick={() => toggleExpand(d.id)}
                      className="text-gray-400 hover:text-gray-100 transition-colors text-xs leading-none"
                    >
                      {expanded.has(d.id) ? "▼" : "▶"}
                    </button>
                  </td>
                  <td className="px-4 py-2 min-w-48">
                    <Input
                      value={d.name}
                      onChange={(e) => updateDraft(d.id, "name", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={d.plugin}
                      onChange={(e) => updateDraft(d.id, "plugin", e.target.value as PluginName)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
                    >
                      {PLUGINS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 min-w-28">
                    <Input
                      placeholder="en, ja, zh…"
                      value={d.language}
                      onChange={(e) => updateDraft(d.id, "language", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 min-w-40">
                    <Input
                      placeholder={t("batchEdit.tagsHint")}
                      value={d.tags}
                      onChange={(e) => updateDraft(d.id, "tags", e.target.value)}
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={d.active}
                      onChange={(e) => updateDraft(d.id, "active", e.target.checked)}
                      className="accent-purple-500 cursor-pointer w-4 h-4"
                    />
                  </td>
                  {/* copy-to-all */}
                  <td className="px-4 py-2 text-right">
                    {drafts.length > 1 && (
                      <button
                        title={t("batchEdit.copyToAll")}
                        onClick={() => copyToAll(d.id)}
                        className="text-xs text-purple-400 hover:text-purple-200 transition-colors whitespace-nowrap"
                      >
                        {t("batchEdit.copyToAll")}
                      </button>
                    )}
                  </td>
                </tr>

                {/* expandable metadata row */}
                {expanded.has(d.id) && (
                  <tr key={`${d.id}-meta`} className="border-b border-gray-800/60 bg-gray-800/30">
                    <td />
                    <td colSpan={6} className="px-6 py-3">
                      <div className="space-y-3">
                        {/* checksum */}
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-xs w-24 shrink-0">
                            {t("batchEdit.meta.checksum")}
                          </span>
                          <Input
                            placeholder="SHA-256…"
                            value={d.checksum}
                            onChange={(e) => updateDraft(d.id, "checksum", e.target.value)}
                            className="font-mono text-xs max-w-sm"
                          />
                        </div>

                        {/* locations */}
                        <div className="flex gap-3">
                          <span className="text-gray-400 text-xs w-24 shrink-0 pt-1">
                            {t("batchEdit.meta.locations")}
                          </span>
                          <div className="flex-1 space-y-2">
                            {d.locations.map((loc, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <Input
                                  placeholder={t("batchEdit.meta.device")}
                                  value={loc.device}
                                  onChange={(e) => updateLocation(d.id, idx, "device", e.target.value)}
                                  className="w-36 text-xs"
                                />
                                <Input
                                  placeholder={t("batchEdit.meta.path")}
                                  value={loc.path}
                                  onChange={(e) => updateLocation(d.id, idx, "path", e.target.value)}
                                  className="flex-1 text-xs font-mono"
                                />
                                <button
                                  onClick={() => removeLocation(d.id, idx)}
                                  className="text-red-400 hover:text-red-200 transition-colors px-1 text-sm"
                                  title={t("batchEdit.meta.removeLocation")}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => addLocation(d.id)}
                              className="text-xs text-purple-400 hover:text-purple-200 transition-colors"
                            >
                              + {t("batchEdit.meta.addLocation")}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
