import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button.tsx";
import { useDeviceStore } from "@/store/device.ts";
import { IdentityPicker } from "@/components/resource/IdentityPicker.tsx";
import { detectPlugin, processFile } from "@/utils/batchImport.ts";
import type { LogEntry } from "@/utils/batchImport.ts";

type FileStatus = "pending" | "processing" | "done" | "error" | "skipped";

interface FileItem {
  path: string;
  plugin: string | null;
  status: FileStatus;
}

interface ImportProgress {
  total: number;
  done: number;
  error: number;
  skipped: number;
  current: string;
}



const LOG_COLORS: Record<string, string> = {
  info: "text-gray-300",
  success: "text-green-400",
  warn: "text-yellow-400",
  error: "text-red-400",
};

const TAIL_SIZE = 40;
const FILE_LIST_CAP = 200; // max rows shown before import starts

export function BatchImportPage() {
  const { deviceName } = useDeviceStore();
  const { t } = useTranslation();

  const [locationIdentity, setLocationIdentity] = useState<string>(deviceName ?? "unknown");
  const [detectedHwId, setDetectedHwId] = useState<string | null>(null);

  // File list only used before/after import. During import we use fileMapRef.
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const fileMapRef = useRef<Map<string, FileItem>>(new Map());

  // Progress state — one React update per completed file, not per log line
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  // Error paths collected during run, shown after completion
  const [errorPaths, setErrorPaths] = useState<string[]>([]);

  const [tail, setTail] = useState<LogEntry[]>([]);
  const tailRef = useRef<LogEntry[]>([]);
  const [logPath, setLogPath] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ImportProgress>({ total: 0, done: 0, error: 0, skipped: 0, current: "" });

  const isElectron = typeof window !== "undefined" && !!window.electron;

  function startFlushInterval() {
    if (flushIntervalRef.current) return;
    flushIntervalRef.current = setInterval(() => {
      setTail([...tailRef.current]);
      setProgress({ ...progressRef.current });
    }, 300);
  }

  function stopFlushInterval() {
    if (flushIntervalRef.current) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    setTail([...tailRef.current]);
    setProgress({ ...progressRef.current });
  }

  useEffect(() => () => stopFlushInterval(), []);

  const addLog = useCallback((entry: LogEntry) => {
    if (window.electron) {
      const line = `${entry.ts} [${entry.level.toUpperCase().padEnd(7)}] ${entry.file.split("/").pop()} — ${entry.message}`;
      void window.electron.appendBatchLog(line);
    }
    tailRef.current = [...tailRef.current.slice(-(TAIL_SIZE - 1)), entry];
  }, []);

  function addPaths(paths: string[]) {
    const newPaths: string[] = [];
    for (const p of paths) {
      if (!fileMapRef.current.has(p)) {
        fileMapRef.current.set(p, { path: p, plugin: detectPlugin(p), status: "pending" });
        newPaths.push(p);
      }
    }
    if (newPaths.length) setFilePaths((prev) => [...prev, ...newPaths]);
  }

  async function detectVolume(p: string) {
    if (!window.electron?.getVolumeId) return;
    try {
      const id = await window.electron.getVolumeId(p);
      if (id) setDetectedHwId(id);
    } catch {
      // non-fatal
    }
  }

  async function handlePickFiles() {
    const paths = await window.electron!.selectPaths("files");
    if (paths.length) {
      addPaths(paths);
      detectVolume(paths[0]);
    }
  }

  async function handlePickDirectory() {
    const dir = await window.electron!.selectPath("directory");
    if (!dir) return;
    detectVolume(dir);
    const paths = await window.electron!.scanDirectory(dir);
    addPaths(paths);
  }

  function handleDropFiles(e: React.DragEvent) {
    e.preventDefault();
    const getPath = window.electron?.getPathForFile;
    const paths: string[] = [];
    for (const file of Array.from(e.dataTransfer.files)) {
      const p = getPath ? getPath(file) : "";
      if (p) paths.push(p);
    }
    if (paths.length) addPaths(paths);
  }

  function handleRemove(path: string) {
    fileMapRef.current.delete(path);
    setFilePaths((prev) => prev.filter((p) => p !== path));
  }

  function handleClear() {
    fileMapRef.current.clear();
    setFilePaths([]);
    tailRef.current = [];
    setTail([]);
    setLogPath(null);
    setProgress(null);
    setErrorPaths([]);
    setDone(false);
  }

  async function handleStart() {
    const pending = filePaths.filter((p) => fileMapRef.current.get(p)?.status === "pending");
    if (!pending.length) return;

    setRunning(true);
    setDone(false);
    setErrorPaths([]);
    abortRef.current = false;
    tailRef.current = [];

    progressRef.current = { total: pending.length, done: 0, error: 0, skipped: 0, current: "" };
    setProgress({ ...progressRef.current });

    if (window.electron) {
      const p = await window.electron.initBatchLog();
      setLogPath(p);
    }

    startFlushInterval();

    const errors: string[] = [];

    for (const path of pending) {
      if (abortRef.current) break;

      progressRef.current.current = path.split("/").pop() ?? path;
      fileMapRef.current.set(path, { ...fileMapRef.current.get(path)!, status: "processing" });

      const statusRef = { value: "done" as FileStatus };
      await processFile(path, {
        deviceName: locationIdentity || (deviceName ?? "unknown"),
        onLog: (entry) => {
          addLog(entry);
          if (entry.level === "error") statusRef.value = "error";
          else if (entry.level === "success") statusRef.value = "done";
          else if (entry.level === "warn" && entry.message.startsWith("Skipped")) statusRef.value = "skipped";
        },
      });

      fileMapRef.current.set(path, { ...fileMapRef.current.get(path)!, status: statusRef.value });

      // Update progress counters (mutable ref — no React update per file)
      if (statusRef.value === "error") { progressRef.current.error++; errors.push(path); }
      else if (statusRef.value === "skipped") progressRef.current.skipped++;
      else progressRef.current.done++;
    }

    progressRef.current.current = "";
    stopFlushInterval();
    setErrorPaths(errors);
    setRunning(false);
    setDone(true);
  }

  function handleStop() {
    abortRef.current = true;
  }

  const pendingCount = filePaths.filter((p) => fileMapRef.current.get(p)?.status === "pending").length;

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-100">{t("batch.title")}</h1>
        {filePaths.length > 0 && !running && (
          <Button type="button" variant="ghost" onClick={handleClear}>
            {t("batch.clearAll")}
          </Button>
        )}
      </div>

      {/* Input actions */}
      {isElectron && (
        <div
          className="flex flex-wrap gap-3 items-center p-4 rounded-xl border-2 border-dashed border-gray-700 hover:border-purple-600 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFiles}
        >
          <Button type="button" onClick={handlePickFiles} disabled={running}>
            {t("batch.selectFiles")}
          </Button>
          <Button type="button" onClick={handlePickDirectory} disabled={running}>
            {t("batch.selectDirectory")}
          </Button>
          <span className="text-xs text-gray-500">{t("batch.dragHint")}</span>
        </div>
      )}

      {/* Location identity — defaults to device, switchable for portable storage */}
      {isElectron && !running && (
        <div className="max-w-sm">
          <IdentityPicker
            label={t("batch.locationIdentity")}
            value={locationIdentity}
            onChange={setLocationIdentity}
            detectedHwId={detectedHwId}
          />
        </div>
      )}

      {/* File list — only shown before import, capped at FILE_LIST_CAP */}
      {filePaths.length > 0 && !running && !done && (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-gray-400">
            {t(filePaths.length !== 1 ? "batch.files_other" : "batch.files", { count: filePaths.length })}
            {filePaths.length > FILE_LIST_CAP && (
              <span className="ml-2 text-gray-600">{t("batch.listCap", { n: FILE_LIST_CAP })}</span>
            )}
          </span>
          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 rounded-lg bg-gray-900 p-2">
            {filePaths.slice(0, FILE_LIST_CAP).map((p) => {
              const f = fileMapRef.current.get(p);
              return (
                <div key={p} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 group text-xs">
                  <span className={`shrink-0 px-1.5 py-0.5 rounded font-mono ${f?.plugin ? "bg-purple-900/60 text-purple-300" : "bg-gray-700 text-gray-400"}`}>
                    {f?.plugin ?? "unknown"}
                  </span>
                  <span className="flex-1 truncate text-gray-300 font-mono" title={p}>
                    {p}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(p)}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live progress — shown during import */}
      {running && progress && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>{t("batch.progressCurrent", { file: progress.current })}</span>
            <span>{progress.done + progress.error + progress.skipped} / {progress.total}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all"
              style={{ width: `${Math.round(((progress.done + progress.error + progress.skipped) / Math.max(progress.total, 1)) * 100)}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs">
            <span className="text-green-400">✓ {progress.done}</span>
            <span className="text-red-400">✗ {progress.error}</span>
            <span className="text-yellow-400">⏭ {progress.skipped}</span>
          </div>
        </div>
      )}

      {/* Post-import summary */}
      {done && progress && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 flex flex-col gap-2">
          <div className="text-sm font-medium text-gray-200">
            {t("batch.summary", { done: progress.done, error: progress.error, skipped: progress.skipped })}
          </div>
          {errorPaths.length > 0 && (
            <div className="max-h-32 overflow-y-auto mt-1">
              {errorPaths.map((p) => (
                <div key={p} className="text-xs text-red-400 font-mono truncate">{p}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Start / Stop */}
      {filePaths.length > 0 && (
        <div className="flex gap-2">
          {!running ? (
            <Button type="button" onClick={handleStart} disabled={pendingCount === 0}>
              {t("batch.startImport", { count: pendingCount })}
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={handleStop}>
              {t("batch.stop")}
            </Button>
          )}
        </div>
      )}

      {/* Log tail panel */}
      {(logPath || tail.length > 0) && (
        <div className="flex flex-col gap-1 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              {t("batch.log")}
              <span className="ml-2 font-normal text-gray-600 normal-case">{t("batch.logTail", { n: TAIL_SIZE })}</span>
            </span>
            {logPath && (
              <button
                type="button"
                onClick={() => window.electron?.openLogDir()}
                className="text-xs text-purple-400 hover:text-purple-300"
                title={logPath}
              >
                {t("batch.openLogDir")} ↗
              </button>
            )}
          </div>
          {logPath && (
            <p className="text-xs text-gray-600 font-mono truncate" title={logPath}>{logPath}</p>
          )}
          <div
            className="flex-1 overflow-y-auto bg-gray-950 rounded-xl p-3 font-mono text-xs min-h-40 max-h-72"
            style={{ overflowAnchor: "auto" }}
          >
            {tail.map((entry, i) => (
              <div key={i} className="flex gap-2 leading-5">
                <span className="text-gray-600 shrink-0">{entry.ts}</span>
                <span className="text-gray-500 shrink-0 max-w-48 truncate" title={entry.file}>
                  {entry.file.split("/").pop()}
                </span>
                <span className={LOG_COLORS[entry.level] ?? "text-gray-300"}>{entry.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {filePaths.length === 0 && !isElectron && (
        <p className="text-gray-500 text-sm">{t("batch.electronOnly")}</p>
      )}
    </div>
  );
}
