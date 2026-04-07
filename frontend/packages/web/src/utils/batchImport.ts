// Batch import utilities: extension→plugin detection and per-file processing.

import type { PluginName } from "@/types/index.ts";
import { resourcesApi } from "@/api/index.ts";
import { seriesApi } from "@/api/series.ts";
import { http } from "@/api/client.ts";
import { extractEbook } from "./ebookMeta.ts";
import { extractMusicMeta } from "./musicMeta.ts";
import { extractVideoMeta } from "./videoMeta.ts";
import { PLUGIN_META_FIELDS } from "./pluginMeta.ts";

// --- Extension → Plugin mapping ---

const EXT_TO_PLUGIN: Record<string, PluginName> = {
  epub: "ebook", pdf: "ebook", mobi: "ebook", azw3: "ebook", txt: "ebook",
  mp4: "video", mkv: "video", avi: "video", mov: "video", webm: "video", m4v: "video",
  mp3: "music", flac: "music", ogg: "music", wav: "music", m4a: "music", aac: "music", opus: "music",
  jpg: "pic", jpeg: "pic", png: "pic", gif: "pic", webp: "pic", avif: "pic",
};

export function detectPlugin(filePath: string): PluginName | null {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_PLUGIN[ext] ?? null;
}

// --- Log entry ---

export type LogLevel = "info" | "success" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  file: string;
  message: string;
}

function ts(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

// --- Main per-file processor ---

export interface BatchOptions {
  deviceName: string;
  onLog: (entry: LogEntry) => void;
}

// Total per-file processing budget (includes fetch + meta + API calls).
const PROCESS_FILE_TIMEOUT_MS = 60_000;

export async function processFile(filePath: string, opts: BatchOptions): Promise<void> {
  const { onLog } = opts;
  const log = (level: LogLevel, message: string) =>
    onLog({ ts: ts(), level, file: filePath, message });

  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<void>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`File processing timed out after 60s`)), PROCESS_FILE_TIMEOUT_MS);
  });

  try {
    await Promise.race([_processFile(filePath, opts), timeoutPromise]);
  } catch (err) {
    log("error", `Aborted: ${(err as Error)?.message ?? err}`);
  } finally {
    clearTimeout(timer!);
  }
}

async function _processFile(filePath: string, opts: BatchOptions): Promise<void> {
  const { deviceName, onLog } = opts;
  const log = (level: LogLevel, message: string) =>
    onLog({ ts: ts(), level, file: filePath, message });

  const plugin = detectPlugin(filePath);
  if (!plugin) {
    log("warn", `Skipped — unknown extension`);
    return;
  }

  const fileName = filePath.split("/").pop() ?? filePath;
  const baseName = fileName.replace(/\.[^.]+$/, "");

  // Step 1: create resource record
  let resourceId: number;
  try {
    const resource = await resourcesApi.create({
      name: baseName,
      plugin,
      type: plugin,
      locations: [{ device: deviceName, path: filePath }],
    });
    resourceId = resource.id;
    log("info", `Created resource #${resourceId} (plugin: ${plugin})`);
  } catch (err) {
    log("error", `Failed to create resource: ${(err as Error)?.message ?? err}`);
    return;
  }

  // Step 2: extract + upload metadata (best-effort)
  if (plugin === "ebook" && filePath.endsWith(".epub")) {
    await processEbook(filePath, resourceId, opts);
  } else if (plugin === "music") {
    await processMusicOrVideo(filePath, plugin, resourceId, opts);
  } else if (plugin === "video") {
    await processMusicOrVideo(filePath, plugin, resourceId, opts);
  } else {
    log("success", "Done (no metadata extraction for this type)");
  }
}

async function processEbook(
  filePath: string,
  resourceId: number,
  { onLog }: BatchOptions
): Promise<void> {
  const log = (level: LogLevel, message: string) =>
    onLog({ ts: ts(), level, file: filePath, message });

  let coverBlob: Blob | null = null;
  let extracted: Record<string, string> = {};

  try {
    const file = await fetchFileAsFile(filePath, "application/epub+zip");
    const { meta, coverBlob: cb } = await extractEbook(file);
    coverBlob = cb;
    extracted = flattenMeta(meta as Record<string, unknown>);
    log("info", `Metadata extracted: ${Object.keys(extracted).join(", ") || "none"}`);
  } catch (err) {
    log("warn", `Metadata extraction failed: ${(err as Error)?.message ?? err}`);
  }

  if (Object.keys(extracted).length > 0) {
    try {
      const payload = buildPayload("ebook", extracted);
      await seriesApi.postMeta("ebook", resourceId, payload);
      log("info", "Metadata saved");
    } catch (err) {
      log("error", `Metadata save failed: ${(err as Error)?.message ?? err}`);
    }
  }

  if (coverBlob) {
    try {
      await http.post(
        `${http.defaults.baseURL}/resources/ebook/${resourceId}/cover`,
        coverBlob,
        { headers: { "Content-Type": "image/jpeg" } }
      );
      log("info", "Cover uploaded");
    } catch (err) {
      log("warn", `Cover upload failed: ${(err as Error)?.message ?? err}`);
    }
  }

  log("success", "Done");
}

async function processMusicOrVideo(
  filePath: string,
  plugin: "music" | "video",
  resourceId: number,
  { onLog }: BatchOptions
): Promise<void> {
  const log = (level: LogLevel, message: string) =>
    onLog({ ts: ts(), level, file: filePath, message });

  let extracted: Record<string, string> = {};
  try {
    const mime = plugin === "music" ? "audio/mpeg" : "video/mp4";
    const file = await fetchFileAsFile(filePath, mime);

    const raw = plugin === "music"
      ? await extractMusicMeta(file)
      : await extractVideoMeta(file);
    extracted = flattenMeta(raw as Record<string, unknown>);
    log("info", `Metadata extracted: ${Object.keys(extracted).join(", ") || "none"}`);
  } catch (err) {
    log("warn", `Metadata extraction failed: ${(err as Error)?.message ?? err}`);
  }

  if (Object.keys(extracted).length > 0) {
    try {
      const payload = buildPayload(plugin, extracted);
      await seriesApi.postMeta(plugin, resourceId, payload);
      log("info", "Metadata saved");
    } catch (err) {
      log("error", `Metadata save failed: ${(err as Error)?.message ?? err}`);
    }
  }

  log("success", "Done");
}

// Max file size to attempt metadata extraction (50 MB). Larger files skip meta.
const MAX_META_FILE_BYTES = 50 * 1024 * 1024;
// Per-file timeout for fetch + metadata extraction (30 seconds total).
const FILE_FETCH_TIMEOUT_MS = 30_000;

async function fetchFileAsFile(filePath: string, mimeType: string): Promise<File> {
  // In Electron renderer, file:// URLs work for local filesystem access.
  // Encode the path to handle spaces and special chars.
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");

  let timer: ReturnType<typeof setTimeout>;
  const controller = new AbortController();
  timer = setTimeout(() => controller.abort(), FILE_FETCH_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(`file://${encoded}`, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) throw new Error(`Cannot read file: ${resp.status}`);

  const contentLength = Number(resp.headers.get("content-length") ?? "0");
  if (contentLength > MAX_META_FILE_BYTES) {
    throw new Error(`File too large for metadata extraction (${Math.round(contentLength / 1024 / 1024)}MB > 50MB)`);
  }

  const buf = await resp.arrayBuffer();
  if (buf.byteLength > MAX_META_FILE_BYTES) {
    throw new Error(`File too large for metadata extraction (${Math.round(buf.byteLength / 1024 / 1024)}MB > 50MB)`);
  }

  return new File([buf], filePath.split("/").pop() ?? "file", { type: mimeType });
}
function flattenMeta(raw: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && v !== "") out[k] = String(v);
  }
  return out;
}

// Build API payload: coerce number fields to numbers.
function buildPayload(plugin: PluginName, extracted: Record<string, string>): Record<string, unknown> {
  const fields = PLUGIN_META_FIELDS[plugin] ?? [];
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extracted)) {
    const field = fields.find((f) => f.key === k);
    payload[k] = field?.type === "number" ? Number(v) : v;
  }
  return payload;
}
