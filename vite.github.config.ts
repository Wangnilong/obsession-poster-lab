import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base:
    process.env.PUBLIC_BASE ??
    (process.env.VERCEL === "1" ? "/" : "/obsession-poster-lab/"),
  plugins: [react()],
  build: {
    outDir: process.env.OUT_DIR ?? "github-dist",
    emptyOutDir: true,
  },
});
