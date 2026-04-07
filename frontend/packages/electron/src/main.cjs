// Electron main process (CommonJS — electron does not support ESM main yet).
/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// Load .env from the repo root so DEV_JWT / ELECTRON_API_URL are available in dev.
if (!app.isPackaged) {
  require("dotenv").config({ path: path.join(__dirname, "..", "..", "..", "..", ".env") });
}

/** @type {BrowserWindow | null} */
let win = null;

function getWebIndexPath() {
  if (app.isPackaged) {
    // Production: bundled as an extraResource by electron-builder.
    return path.join(process.resourcesPath, "web", "index.html");
  }
  // Development: web package built locally alongside this package.
  return path.join(__dirname, "..", "..", "web", "dist", "index.html");
}

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

  void win.loadFile(getWebIndexPath());

  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  // Prevent Electron from navigating the window when files are dropped onto it.
  win.webContents.on("will-navigate", (event, url) => {
    console.log("[main] will-navigate blocked:", url);
    event.preventDefault();
  });

  win.webContents.on("did-start-navigation", (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame) console.log("[main] did-start-navigation:", url, { isInPlace });
  });
}

app.whenReady().then(() => {
  // IPC: launch Moonlight for game streaming.
  ipcMain.handle("launch-moonlight", async (_event, { host, appName }) => {
    const url = `moonlight://stream/${encodeURIComponent(host)}/${encodeURIComponent(appName)}`;
    await shell.openExternal(url);
    return { ok: true };
  });

  // IPC: native file/folder picker (reliable fallback for drag-and-drop).
  ipcMain.handle("select-path", async (_event, { mode } = {}) => {
    const props = mode === "directory"
      ? ["openDirectory"]
      : ["openFile", "openDirectory"];
    const result = await dialog.showOpenDialog(win, { properties: props });
    console.log("[main] select-path result:", result.filePaths);
    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  // IPC: multi-file picker — returns string[] of selected paths.
  ipcMain.handle("select-paths", async (_event, { mode } = {}) => {
    const props = mode === "directory"
      ? ["openDirectory"]
      : ["openFile", "multiSelections"];
    const result = await dialog.showOpenDialog(win, { properties: props });
    console.log("[main] select-paths result:", result.filePaths);
    return result.canceled ? [] : result.filePaths;
  });

  // IPC: recursively scan a directory and return all file paths.
  ipcMain.handle("scan-directory", (_event, { dirPath }) => {
    const results = [];
    function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
      catch { return; }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue; // skip hidden
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); }
        else if (entry.isFile()) { results.push(full); }
      }
    }
    walk(dirPath);
    console.log(`[main] scan-directory ${dirPath}: ${results.length} files`);
    return results;
  });

  // IPC: relay drag-drop file paths resolved in preload context.
  ipcMain.handle("resolve-drop-path", (_event, { name, size, type }) => {
    console.log("[main] resolve-drop-path called:", { name, size, type });
    // File.path is only accessible in the renderer; this is a debug relay.
    return null;
  });

  // IPC: batch import log — write to file, not memory.
  let batchLogPath = null;
  ipcMain.handle("init-batch-log", () => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const logDir = app.getPath("logs");
    try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
    batchLogPath = path.join(logDir, `batch-import-${ts}.log`);
    fs.writeFileSync(batchLogPath, `Batch import started at ${new Date().toISOString()}\n`);
    console.log("[main] batch log:", batchLogPath);
    return batchLogPath;
  });

  ipcMain.handle("append-batch-log", (_event, { line }) => {
    if (batchLogPath) {
      try { fs.appendFileSync(batchLogPath, line + "\n"); } catch {}
    }
  });

  ipcMain.handle("open-log-dir", () => {
    const logDir = app.getPath("logs");
    void shell.openPath(logDir);
    return logDir;
  });

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

  // IPC: return the hardware volume UUID / serial for the drive containing filePath.
  // Used to identify portable storage so the user can associate a friendly name with it.
  ipcMain.handle("get-volume-id", (_event, { filePath }) => {
    try {
      const plat = process.platform;
      if (plat === "darwin") {
        // df gives us the device node for the mount that owns the path.
        const dfOut = execFileSync("df", [filePath], { encoding: "utf8" });
        const dfLines = dfOut.trim().split("\n");
        const mountPoint = dfLines[dfLines.length - 1].split(/\s+/).pop();
        const diskutilOut = execFileSync("diskutil", ["info", mountPoint], { encoding: "utf8" });
        const uuidMatch = diskutilOut.match(/Volume UUID:\s+([A-F0-9-]+)/i);
        if (uuidMatch) return uuidMatch[1];
        const diskMatch = diskutilOut.match(/Device Identifier:\s+(\S+)/i);
        return diskMatch ? diskMatch[1] : null;
      } else if (plat === "win32") {
        const driveLetter = path.parse(filePath).root.replace(/[\\/]/g, ""); // e.g. "C:"
        const out = execFileSync(
          "wmic",
          ["logicaldisk", "where", `Name='${driveLetter}'`, "get", "VolumeSerialNumber"],
          { encoding: "utf8" },
        );
        const lines = out.trim().split("\n").filter(Boolean);
        return lines[1]?.trim() || null;
      } else {
        // Linux: findmnt gives the UUID of the filesystem containing the path.
        const out = execFileSync("findmnt", ["-n", "-o", "UUID", "--target", filePath], {
          encoding: "utf8",
        });
        return out.trim() || null;
      }
    } catch (e) {
      console.error("[main] get-volume-id error:", e.message);
      return null;
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
