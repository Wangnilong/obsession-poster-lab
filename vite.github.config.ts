import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.VERCEL === "1" ? "/" : "/obsession-poster-lab/",
  plugins: [react()],
  build: {
    outDir: "github-dist",
    emptyOutDir: true,
  },
});
