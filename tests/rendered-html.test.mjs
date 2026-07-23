import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the reusable Cosmos film index", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /COSMOS FILM 42/);
  assert.match(html, /cosmos-film42-logo\.png/);
  assert.match(html, /电影项目/);
  assert.match(html, /\.\/obsession\//);
  assert.match(html, /COMING SOON/);
});

test("server-renders the Obsession photo booth on its film route", async () => {
  const response = await render("/obsession");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /OBSESSION/);
  assert.match(html, /进入相机/);
  assert.match(html, /original-poster\.png/);
  assert.match(html, /cosmos-film42-logo\.png/);
  assert.match(html, /3508 × 4961/);
  assert.match(html, /2480 × 3508/);
  assert.match(html, /直接打印 A4/);
  assert.match(html, /下载 A4 PDF/);
  assert.match(html, /保存 A3 屏幕版/);
  assert.match(html, /电影级场景与灯光重绘/);
});

test("keeps pose AI and its runtime assets on-device", async () => {
  const [page, model, wasm] = await Promise.all([
    readFile(new URL("../app/obsession-poster.tsx", import.meta.url), "utf8"),
    stat(new URL("../public/models/pose_landmarker_lite.task", import.meta.url)),
    stat(new URL("../public/mediapipe/wasm/vision_wasm_internal.wasm", import.meta.url)),
  ]);

  assert.match(page, /@mediapipe\/tasks-vision/);
  assert.match(page, /detectForVideo/);
  assert.match(page, /controlsFromPose/);
  assert.match(page, /\(\[0, 3, 10\] as TimerSeconds\[\]\)/);
  assert.ok(model.size > 5_000_000);
  assert.ok(wasm.size > 10_000_000);
});

test("keeps large uploads memory-safe and sends explicit cloud AI edits", async () => {
  const page = await readFile(new URL("../app/obsession-poster.tsx", import.meta.url), "utf8");
  const api = await readFile(new URL("../api/generate-poster.js", import.meta.url), "utf8");

  assert.match(page, /MAX_WORKING_PIXELS = 12_000_000/);
  assert.match(page, /prepareWorkingImage/);
  assert.match(page, /prepareCloudAiUpload/);
  assert.match(page, /\/api\/generate-poster/);
  assert.match(page, /analyzeImageTone/);
  assert.match(page, /0\.4 \/ Math\.max\(0\.22, highlight\)/);
  assert.doesNotMatch(page, /setPointerCapture/);
  assert.match(page, /subjectFalloff/);
  assert.match(page, /ghostExposure/);
  assert.match(page, /hue-rotate\(168deg\)/);
  assert.match(page, /paintHandLight\(0\.29, 0\.61\)/);
  assert.match(page, /paintHandLight\(0\.71, 0\.61\)/);
  assert.match(page, /obsession-title\.png/);
  assert.doesNotMatch(page, /"\.\/obsession-title\.png"/);
  assert.match(page, /"\/models\/pose_landmarker_lite\.task"/);
  assert.match(page, /createA4Pdf/);
  assert.match(page, /outputProfile === "print"/);
  assert.match(page, /@page\{size:A4 portrait/);
  assert.doesNotMatch(page, /handGlow/);

  assert.match(api, /generateImage/);
  assert.match(api, /openai\/gpt-image-2/);
  assert.match(api, /quality: "high"/);
  assert.match(api, /size: "2048x2896"/);
  assert.match(api, /images: \[new Uint8Array/);
  assert.match(api, /PRESERVE EXACTLY/);
  assert.doesNotMatch(api, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(api, /sk-[A-Za-z0-9_-]{20,}/);
});
