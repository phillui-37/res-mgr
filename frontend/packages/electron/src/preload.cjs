// Electron preload — exposes a minimal safe API to the renderer via contextBridge.
/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer, webUtils } = require("electron");

// Allow overriding the backend URL and seeding a dev JWT via env vars baked in at launch time.
const API_URL = process.env.ELECTRON_API_URL || "http://localhost:3000";
const DEV_JWT = process.env.DEV_JWT || null;

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  platform: process.platform,
  apiUrl: API_URL,
  devJwt: DEV_JWT,
  // Moonlight game streaming: launch via deeplink (desktop only).
  launchMoonlight: (host, appName) =>
    ipcRenderer.invoke("launch-moonlight", { host, appName }),
  // Notify main process to open a native webview window for online provider.
  openWebView: (url, title) =>
    ipcRenderer.invoke("open-webview", { url, title }),
  // Native file/folder picker dialog — always works regardless of drag-and-drop issues.
  selectPath: (mode) =>
    ipcRenderer.invoke("select-path", { mode }),
  // Multi-file or directory picker — returns string[].
  selectPaths: (mode) =>
    ipcRenderer.invoke("select-paths", { mode }),
  // Recursively scan a directory and return all file paths.
  scanDirectory: (dirPath) =>
    ipcRenderer.invoke("scan-directory", { dirPath }),
  // Batch import logging — write to file.
  initBatchLog: () =>
    ipcRenderer.invoke("init-batch-log"),
  appendBatchLog: (line) =>
    ipcRenderer.invoke("append-batch-log", { line }),
  openLogDir: () =>
    ipcRenderer.invoke("open-log-dir"),
  // Electron v28+ replaced File.path with webUtils.getPathForFile — must be called in preload.
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // Return the OS-level volume UUID / serial for the drive that contains the given path.
  // Returns null when detection is not possible.
  getVolumeId: (filePath) => ipcRenderer.invoke("get-volume-id", { filePath }),
});
