// Electron main process (CommonJS — electron does not support ESM main yet).
/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, shell } = require("electron");
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
    void win.loadURL(`http://localhost:${VITE_PORT}`);
    win.webContents.openDevTools();
  } else {
    void win.loadFile(path.join(__dirname, "../dist/web/index.html"));
  }

  // Open external links in the system browser, not in Electron.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
