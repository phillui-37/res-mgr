// Electron main process (CommonJS — electron does not support ESM main yet).
/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");

const IS_DEV = process.env.NODE_ENV !== "production";
const VITE_PORT = 5173;

/** @type {BrowserWindow | null} */
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f1117",
  });

  if (IS_DEV) {
    // In dev, point at the Vite dev server of the web package.
    void win.loadURL(`http://localhost:${VITE_PORT}`);
    win.webContents.openDevTools();
  } else {
    // In production, load the pre-built web package bundled as an extraResource.
    const webDist = path.join(process.resourcesPath, "web", "index.html");
    void win.loadFile(webDist);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  // IPC: launch Moonlight for game streaming.
  ipcMain.handle("launch-moonlight", async (_event, { host, appName }) => {
    const url = `moonlight://stream/${encodeURIComponent(host)}/${encodeURIComponent(appName)}`;
    await shell.openExternal(url);
    return { ok: true };
  });

  // IPC: open a URL in a new native webview window.
  ipcMain.handle("open-webview", (_event, { url, title }) => {
    const child = new BrowserWindow({
      width: 1024,
      height: 768,
      title: title || "Web View",
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    void child.loadURL(url);
    return { ok: true };
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
