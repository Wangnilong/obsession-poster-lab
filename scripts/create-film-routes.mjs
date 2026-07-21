import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? "github-dist");
const source = resolve(outDir, "index.html");
const filmRoutes = ["obsession"];

await Promise.all(
  filmRoutes.map(async (slug) => {
    const routeDir = resolve(outDir, slug);
    await mkdir(routeDir, { recursive: true });
    await copyFile(source, resolve(routeDir, "index.html"));
  }),
);

// GitHub Pages and simple static hosts can use this as the SPA fallback.
await copyFile(source, resolve(outDir, "404.html"));
