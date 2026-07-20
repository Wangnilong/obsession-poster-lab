import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Obsession photo booth", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /OBSESSION Poster Lab/);
  assert.match(html, /打开相机/);
  assert.match(html, /original-poster\.png/);
  assert.match(html, /3508 × 4961/);
  assert.match(html, /下载 A3 打印版/);
});

test("keeps pose AI and its runtime assets on-device", async () => {
  const [page, model, wasm] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
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

test("keeps large uploads memory-safe and the subject locally exposed", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /MAX_WORKING_PIXELS = 12_000_000/);
  assert.match(page, /prepareWorkingImage/);
  assert.match(page, /analyzeImageTone/);
  assert.match(page, /0\.4 \/ Math\.max\(0\.22, highlight\)/);
  assert.doesNotMatch(page, /setPointerCapture/);
  assert.match(page, /subjectFalloff/);
  assert.match(page, /ghostExposure/);
  assert.match(page, /hue-rotate\(168deg\)/);
  assert.match(page, /paintHandLight\(0\.29, 0\.61\)/);
  assert.match(page, /paintHandLight\(0\.71, 0\.61\)/);
  assert.doesNotMatch(page, /handGlow/);
});
