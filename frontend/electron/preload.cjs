// Electron preload — exposes a minimal safe API to the renderer via contextBridge.
/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  isElectron: true,
  platform: process.platform,
  // Moonlight game streaming: launch via deeplink (desktop only).
  launchMoonlight: (host, appName) =>
    ipcRenderer.invoke("launch-moonlight", { host, appName }),
  // Notify main process to open a native webview window for online provider.
  openWebView: (url, title) =>
    ipcRenderer.invoke("open-webview", { url, title }),
});
