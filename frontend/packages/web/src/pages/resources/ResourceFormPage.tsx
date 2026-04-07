import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { resourcesApi } from "@/api/index.ts";
import { http } from "@/api/client.ts";
import { seriesApi } from "@/api/series.ts";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { IdentityPicker } from "@/components/resource/IdentityPicker.tsx";
import type { PluginName } from "@/types/index.ts";
import { PLUGIN_META_FIELDS } from "@/utils/pluginMeta.ts";
import { extractVideoMeta } from "@/utils/videoMeta.ts";
import { extractMusicMeta } from "@/utils/musicMeta.ts";
import { extractEbook } from "@/utils/ebookMeta.ts";
import { useDeviceStore } from "@/store/device.ts";

const PLUGINS: PluginName[] = ["ebook", "music", "video", "game", "pic", "online_viewer"];

// Plugins that support client-side metadata extraction from a local file.
const EXTRACTABLE: PluginName[] = ["video", "music", "ebook"];

const FILE_ACCEPT: Partial<Record<PluginName, string>> = {
  video: "video/*",
  music: "audio/*",
  ebook: ".epub",
};

export function ResourceFormPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { deviceName } = useDeviceStore();
  const [name, setName] = useState("");
  const [plugin, setPlugin] = useState<PluginName>("ebook");
  const [location, setLocation] = useState("");
  const [locationIdentity, setLocationIdentity] = useState<string>(deviceName ?? "unknown");
  const [detectedHwId, setDetectedHwId] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [meta, setMeta] = useState<Record<string, string>>({});

  const [isDragOver, setIsDragOver] = useState(false);
  const [dropDebug, setDropDebug] = useState<Record<string, unknown> | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isElectron = typeof window !== "undefined" && !!window.electron;
  const metaFields = PLUGIN_META_FIELDS[plugin] ?? [];

  function changePlugin(p: PluginName) {
    setPlugin(p);
    setMeta({});
    setExtractError(null);
  }

  function applyExtracted(extracted: Record<string, unknown>) {
    const next: Record<string, string> = { ...meta };
    for (const [k, v] of Object.entries(extracted)) {
      if (v != null && v !== "") next[k] = String(v);
    }
    setMeta(next);

    // Auto-fill resource name from extracted title if still empty.
    const title = extracted.title as string | undefined;
    if (title && !name) setName(title);
  }

  async function extractFromFile(file: File) {
    setExtracting(true);
    setExtractError(null);
    try {
      if (plugin === "video") {
        const result = await extractVideoMeta(file);
        applyExtracted(result as Record<string, unknown>);
      } else if (plugin === "music") {
        const result = await extractMusicMeta(file);
        applyExtracted(result as Record<string, unknown>);
      } else if (plugin === "ebook") {
        const { meta: result, coverBlob: cover } = await extractEbook(file);
        applyExtracted(result as Record<string, unknown>);
        setCoverBlob(cover);
      }
    } catch (err) {
      setExtractError((err as Error)?.message ?? "Failed to extract metadata.");
    } finally {
      setExtracting(false);
    }
  }

  // --- Drag-and-drop handlers ---

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const getPath = window.electron?.getPathForFile;
    let resolvedFile: File | null = null;
    let resolvedPath = "";

    // Try files list first.
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      resolvedFile = files[0];
      resolvedPath = getPath ? getPath(resolvedFile) : "";
    }

    // Fallback: items API.
    if (!resolvedPath) {
      const items = Array.from(e.dataTransfer.items);
      for (const item of items) {
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) {
            resolvedFile = f;
            resolvedPath = getPath ? getPath(f) : "";
            if (resolvedPath) break;
          }
        }
      }
    }

    if (resolvedPath) {
      setLocation(resolvedPath);
      setDropDebug(null);
      detectVolume(resolvedPath);
      if (resolvedFile && EXTRACTABLE.includes(plugin)) {
        await extractFromFile(resolvedFile);
      }
    } else {
      setDropDebug({
        types: Array.from(e.dataTransfer.types),
        filesLen: files.length,
        note: "getPathForFile returned empty — check Electron preload",
      });
    }
  }

  async function handleBrowse() {
    const p = await window.electron!.selectPath();
    if (p) {
      setLocation(p);
      detectVolume(p);
    }
  }

  async function detectVolume(p: string) {
    if (!window.electron?.getVolumeId) return;
    try {
      const id = await window.electron.getVolumeId(p);
      setDetectedHwId(id);
    } catch {
      // non-fatal
    }
  }

  async function handleLocalFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await extractFromFile(file);
  }

  // --- Submit ---

  const create = useMutation({
    mutationFn: () =>
      resourcesApi.create({
        name,
        plugin,
        type: plugin,
        locations: location ? [{ device: locationIdentity || (deviceName ?? "unknown"), path: location }] : [],
        language: language || undefined,
      }),
    onSuccess: async (r) => {
      const metaEntries = Object.entries(meta).filter(([, v]) => v !== "");
      if (metaEntries.length > 0) {
        const payload: Record<string, unknown> = {};
        for (const [k, v] of metaEntries) {
          const field = metaFields.find((f) => f.key === k);
          payload[k] = field?.type === "number" ? Number(v) : v;
        }
        try {
          await seriesApi.postMeta(plugin, r.id, payload);
        } catch {
          // non-fatal
        }
      }
      if (plugin === "ebook" && coverBlob) {
        try {
          await http.post(
            `${http.defaults.baseURL}/resources/ebook/${r.id}/cover`,
            coverBlob,
            { headers: { "Content-Type": "image/jpeg" } }
          );
        } catch {
          // non-fatal — cover is cosmetic
        }
      }
      navigate(`/resources/${r.plugin}/${r.id}`);
    },
  });

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-bold text-gray-100 mb-6">{t("form.title")}</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        {/* Basic fields */}
        <Input id="name" label={t("form.name")} value={name} onChange={(e) => setName(e.target.value)} required />

        <div className="flex flex-col gap-1">
          <label htmlFor="plugin" className="text-xs text-gray-400">{t("form.plugin")}</label>
          <select
            id="plugin"
            value={plugin}
            onChange={(e) => changePlugin(e.target.value as PluginName)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
          >
            {PLUGINS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Location + drag-drop */}
        <div
          onDragEnter={isElectron ? handleDragEnter : undefined}
          onDragOver={isElectron ? handleDragOver : undefined}
          onDragLeave={isElectron ? handleDragLeave : undefined}
          onDrop={isElectron ? handleDrop : undefined}
          className={`rounded-lg transition-all ${isDragOver ? "ring-2 ring-purple-500 bg-purple-950/20" : ""}`}
        >
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                id="location"
                label={isElectron ? t("form.location") : t("form.locationWeb")}
                placeholder={t("form.locationPlaceholder")}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            {isElectron && (
              <Button type="button" variant="ghost" onClick={handleBrowse} className="shrink-0 mb-0.5">
                {t("form.browse")}
              </Button>
            )}
          </div>
          {isDragOver && (
            <p className="text-xs text-purple-400 mt-1 px-1">{EXTRACTABLE.includes(plugin) ? t("form.dropHintExtract") : t("form.dropHint")}</p>
          )}
          {dropDebug && (
            <div className="mt-2 bg-yellow-950/60 border border-yellow-700 rounded-lg px-3 py-2 text-xs font-mono text-yellow-300 break-all">
              <p className="font-bold mb-1">⚠ Drop debug:</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(dropDebug, null, 2)}</pre>
              <button type="button" onClick={() => setDropDebug(null)} className="mt-1 text-yellow-500 hover:text-yellow-300">dismiss</button>
            </div>
          )}
        </div>

        {/* Location identity — defaults to device, switchable to saved portable storage or custom */}
        <IdentityPicker
          label={t("form.locationIdentity")}
          value={locationIdentity}
          onChange={setLocationIdentity}
          detectedHwId={detectedHwId}
        />

        <Input
          id="language"
          label={t("form.language")}
          placeholder={t("form.languagePlaceholder")}
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        />

        {/* Local file extraction (for all extractable plugins) */}
        {EXTRACTABLE.includes(plugin) && (
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">
              {t("form.extractFile")}
              <span className="text-gray-600 ml-1">{t("form.extractHint")}</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT[plugin] ?? "*"}
              onChange={handleLocalFile}
              className="text-sm text-gray-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-gray-700 file:text-gray-200 hover:file:bg-gray-600"
            />
            {extracting && <p className="text-xs text-purple-400">{t("form.extracting")}</p>}
            {extractError && <p className="text-xs text-red-400">{extractError}</p>}
          </div>
        )}

        {/* Per-plugin metadata fields */}
        {metaFields.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t("form.metadata")}</h2>
            <div className="grid grid-cols-2 gap-3">
              {metaFields.map((f) => (
                <Input
                  key={f.key}
                  label={f.label}
                  type={f.type ?? "text"}
                  value={meta[f.key] ?? ""}
                  onChange={(e) => setMeta((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              ))}
            </div>
          </section>
        )}

        {create.isError && (
          <p className="text-red-400 text-sm">
            {(create.error as Error)?.message ?? t("form.error")}
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <Button type="submit" disabled={create.isPending || !name}>
            {create.isPending ? t("form.saving") : t("form.create")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            {t("form.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
