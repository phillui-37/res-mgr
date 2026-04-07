// Type declarations for the Electron contextBridge API exposed via preload.cjs.

interface ElectronAPI {
  isElectron: true;
  platform: string;
  apiUrl: string;
  devJwt: string | null;
  launchMoonlight: (host: string, appName: string) => Promise<{ ok: boolean }>;
  openWebView: (url: string, title?: string) => Promise<{ ok: boolean }>;
  selectPath: (mode?: "file" | "directory") => Promise<string | null>;
  /** Returns multiple selected file paths (mode="files") or scans directory (mode="directory"). */
  selectPaths: (mode?: "files" | "directory") => Promise<string[]>;
  /** Recursively scan a directory and return all file paths. */
  scanDirectory: (dirPath: string) => Promise<string[]>;
  /** Batch import log — initialise a new log file, returns its path. */
  initBatchLog: () => Promise<string>;
  /** Append a line to the current batch import log file. */
  appendBatchLog: (line: string) => Promise<void>;
  /** Open the OS logs directory in Finder/Explorer. */
  openLogDir: () => Promise<string>;
  /** Electron v28+: replaces the removed File.path property. Must be called via preload. */
  getPathForFile: (file: File) => string;
  /** Return the OS-level volume UUID / serial for the drive containing filePath. Null if unavailable. */
  getVolumeId: (filePath: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
