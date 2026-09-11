import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { zipSync } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = resolve(root, "extensions/wechat-importer");
const files = {};
for (const name of (await readdir(source)).sort()) files[name] = [new Uint8Array(await readFile(resolve(source, name))), { mtime: new Date("2026-09-11T00:00:00Z") }];
await mkdir(resolve(root, "public/downloads"), { recursive: true });
const archive = zipSync(files, { level: 9 });
const { version } = JSON.parse(await readFile(resolve(source, "manifest.json"), "utf8"));
await writeFile(resolve(root, "public/downloads/cosmos-wechat-importer.zip"), archive);
await writeFile(resolve(root, `public/downloads/cosmos-wechat-importer-${version}.zip`), archive);
console.log(`Packaged ${Object.keys(files).length} extension files`);
