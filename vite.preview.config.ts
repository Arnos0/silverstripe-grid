/// <reference types="vitest/config" />
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    outDir: "client/dist",
    copyPublicDir: false,
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "client/src/preview/index.ts"),
      name: "GridInspectPreview",
      formats: ["iife"],
      fileName: () => "js/preview.js",
    },
    rolldownOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.names.some((name) => name.endsWith(".css"))) {
            return "styles/preview.css";
          }
          return "assets/[name][extname]";
        },
      },
    },
  },
});
