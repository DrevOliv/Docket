import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// In dev, hit Vite on :5173 and let it proxy /api → FastAPI on :8765.
// In prod, FastAPI serves the built bundle directly.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8765",
      "/ws":  { target: "ws://localhost:8765", ws: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
