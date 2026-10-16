import { defineConfig } from "vite";

// Baut das Kommandozeilen-Werkzeug für den PDF-Import nach build/cli/import-pdfs.js
export default defineConfig({
  resolve: { tsconfigPaths: true },
  publicDir: false,
  build: {
    ssr: "scripts/import-cli.ts",
    outDir: "build/cli",
    emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "import-pdfs.js", format: "esm" } },
  },
  ssr: {
    external: ["better-sqlite3", "playwright-core", "tesseract.js", "pdfjs-dist", "@napi-rs/canvas", "@tesseract.js-data/deu", "pdf-lib"],
  },
});
