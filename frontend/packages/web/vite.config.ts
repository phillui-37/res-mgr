import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative base so asset paths work under both a web server and file:// (Electron production).
  base: "./",
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
      "/ws": { target: "ws://localhost:3000", ws: true },
    },
  },
  optimizeDeps: {
    exclude: ["mediainfo.js"],
  },
  build: {
    // Output to dist/ — used directly by web servers AND referenced by electron package
    outDir: "dist",
  },
});
