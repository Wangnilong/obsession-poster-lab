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

test("server-renders the cosmosfilm42 introduction index", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /宇宙放映42/);
  assert.match(html, /把值得的电影/);
  assert.match(html, /带到愿意相遇的人面前/);
  assert.match(html, /起点是一次/);
  assert.match(html, /想一起看电影的冲动/);
  assert.match(html, /我们把一次放映，做成五个连续动作/);
  assert.doesNotMatch(html, /把实践沉淀成「映集」/);
  assert.match(html, /intro42-current intro42-current-top/);
  assert.match(html, /intro42-hero-mark/);
  assert.match(html, /intro42-collage-person/);
  assert.match(html, /下一场：/);
  assert.match(html, /Kill Bill/);
  assert.match(html, /\/kill-bill\//);
  assert.match(html, /\/cosmos42\/logo\.png/);
});

test("server-renders the Kill Bill artefact generators", async () => {
  const response = await render("/kill-bill");
  assert.equal(response.status, 200);

  const [html, source, css] = await Promise.all([
    response.text(),
    readFile(new URL("../app/kill-bill-generator.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(html, /DEATH LIST FIVE/);
  assert.match(html, /暗杀名单/);
  assert.match(html, /KILLER LICENSE/);
  assert.match(html, /\/kill-bill\/cosmos-kill-bill-logo\.png/);
  assert.match(html, /杀手身份卡/);
  assert.match(html, /上传证件照/);
  assert.match(html, /下载 A3 图片/);
  assert.match(html, /下载并保存本地/);
  assert.match(html, /下载并展示到作品墙/);
  assert.match(html, /两个操作都只下载正面/);
  assert.match(css, /\.kb-license-maker \.kb-license-share[\s\S]*background: #090906/);
  assert.doesNotMatch(html, /保存正面到手机/);
  assert.doesNotMatch(html, /保存背面到手机/);
  assert.match(html, /正面与卡面姓名留存在管理员后台/);
  assert.match(html, /玩家作品/);
  assert.match(html, /下载时会自动在管理员后台留档/);
  assert.match(html, /所有暗杀名单和私密小卡只在后台留档/);
  assert.ok(html.indexOf('id="id-card"') < html.indexOf('id="death-list"'));
  assert.ok(html.indexOf('id="death-list"') < html.indexOf('id="community"'));
  assert.match(source, /left\.cardType === "killer-license" \? -1 : 1/);
  assert.match(source, /cardType: "death-list"/);
  assert.match(source, /cardType: "death-list"[\s\S]*visibility: "private"/);
  assert.match(source, /不会出现在玩家作品墙/);
  assert.match(source, /按住照片拖动位置/);
  assert.match(source, /恢复居中/);
  assert.match(source, /onPointerMove={handlePhotoPointerMove}/);
  assert.match(source, /drawImageCover\(context, photo, photoX, photoY, photoWidth, photoHeight, photoPosition\)/);
  assert.doesNotMatch(source, /downloadCanvas\(licenseBackRef\.current/);
});

test("server-renders a poster-only screening archive index", async () => {
  const response = await render("/archive");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /SCREENING ARCHIVE/);
  assert.match(html, /archive-poster-grid/);
  assert.match(html, /aria-label="01 期 迷恋 OBSESSION"/);
  assert.match(html, /aria-label="02 期 杀死比尔 KILL BILL"/);
  assert.match(html, /\/archive\/obsession\//);
  assert.match(html, /\/archive\/kill-bill\//);
  assert.match(html, /\/archive\/admin\//);
  assert.match(html, /death-list-reference\.jpg/);
  assert.doesNotMatch(html, /archive-entry-grid/);
});

test("server-renders each film archive with separate content tabs", async () => {
  const [obsessionResponse, killBillResponse] = await Promise.all([
    render("/archive/obsession"),
    render("/archive/kill-bill"),
  ]);
  assert.equal(obsessionResponse.status, 200);
  assert.equal(killBillResponse.status, 200);

  const [obsessionHtml, killBillHtml, source] = await Promise.all([
    obsessionResponse.text(),
    killBillResponse.text(),
    readFile(new URL("../app/archive-film-page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(obsessionHtml, /ISSUE 01/);
  assert.doesNotMatch(obsessionHtml, /花为什么挡住了脸/);
  assert.match(obsessionHtml, /暂无已发布内容/);
  assert.match(obsessionHtml, /\?section=articles/);
  assert.match(obsessionHtml, /\?section=photos/);
  assert.match(obsessionHtml, /\?section=tools/);
  assert.match(obsessionHtml, /\?section=merch/);
  assert.doesNotMatch(obsessionHtml, /海报暗房成片/);
  assert.match(killBillHtml, /KILL BILL/);
  assert.match(source, /history\.pushState/);
});

test("server-renders the protected content desk interface", async () => {
  const response = await render("/archive/admin");
  assert.equal(response.status, 200);

  const [html, source, cardAdminSource] = await Promise.all([
    response.text(),
    readFile(new URL("../app/archive-admin-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/card-creations-admin.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(html, /内容后台/);
  assert.match(html, /编辑登录/);
  assert.match(html, /登录以后/);
  assert.doesNotMatch(html, /手机预览/);
  assert.match(source, /archive-workspace-nav/);
  assert.match(source, /玩家作品/);
  assert.match(source, /CardCreationsAdmin/);
  assert.match(cardAdminSource, /下载类型/);
  assert.match(cardAdminSource, /永久删除/);
  assert.match(source, /CloudBase/);
  assert.match(source, /signInArchiveUser/);
});

test("keeps archive roles and CloudBase publishing out of static passwords", async () => {
  const [adminPage, archiveClient, cardClient, archiveApi, filmPage, config] = await Promise.all([
    readFile(new URL("../app/archive-admin-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/cloudbase-archive.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/cloudbase-cards.ts", import.meta.url), "utf8"),
    readFile(new URL("../cloudfunctions/archive-api/index.js", import.meta.url), "utf8"),
    readFile(new URL("../app/archive-film-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/cloudbase-config.json", import.meta.url), "utf8"),
  ]);

  assert.match(archiveClient, /huaishan: "admin"/);
  assert.match(archiveClient, /wangnilong: "admin"/);
  assert.match(archiveClient, /yuzhou: "photo-uploader"/);
  assert.match(archiveClient, /signInWithUsernameAndPassword/);
  assert.match(archiveClient, /collection\("archive_content"\)/);
  assert.match(archiveClient, /uploadFile/);
  assert.match(archiveClient, /layout: layout\.length/);
  assert.match(archiveClient, /loadAdminCardCreations/);
  assert.match(archiveClient, /action: "admin-cards"/);
  assert.match(archiveClient, /action: "set-card-status"/);
  assert.match(archiveClient, /action: "delete-card"/);
  assert.match(archiveClient, /action: "export-card-images"/);
  assert.match(archiveClient, /cardType/);
  assert.match(cardClient, /consentToStore: true/);
  assert.match(cardClient, /consentToPublish: input\.visibility === "public"/);
  assert.match(cardClient, /canvasToShareImage/);
  assert.match(cardClient, /targetBytes = 52 \* 1024/);
  assert.match(cardClient, /maxDimension = Math\.floor\(maxDimension \* 0\.78\)/);
  assert.match(cardClient, /作品没有传上去/);
  assert.match(archiveApi, /collection\("card_creations"\)/);
  assert.match(archiveApi, /allowedCardTypes = new Set\(\["death-list", "killer-license"\]\)/);
  assert.match(archiveApi, /\["id-card", "killer-card", "license"\]/);
  assert.match(archiveApi, /legacy-\$\{crypto\.randomUUID\(\)\}/);
  assert.match(archiveApi, /请先填写卡面姓名/);
  assert.doesNotMatch(archiveApi, /作品类型或名字不正确/);
  assert.match(archiveApi, /visibility: "public"/);
  assert.match(archiveApi, /visibility === "public" \? "published" : "hidden"/);
  assert.match(archiveApi, /暗杀名单只允许后台留档/);
  assert.match(archiveApi, /exportCardImages/);
  assert.match(archiveApi, /requestedCardType \|\| "killer-license"/);
  assert.match(archiveApi, /event\.action === "delete-card"/);
  assert.doesNotMatch(archiveApi, /请选择要下载的作品模块/);
  assert.match(archiveApi, /new JSZip/);
  assert.match(archiveApi, /adminUserIds/);
  assert.match(archiveApi, /requireAdmin/);
  assert.match(adminPage, /photo-uploader/);
  assert.match(filmPage, /loadArchiveDocument/);
  assert.match(filmPage, /ArchiveFilmView/);
  assert.doesNotMatch(`${adminPage}${archiveClient}${config}`, /123456/);
});

test("old sample article links show the managed archive without the retired article", async () => {
  const response = await render("/issues/obsession");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.doesNotMatch(html, /花为什么|挡住了脸|READING INDEX/);
  assert.match(html, /暂无已发布内容/);
  assert.match(html, /\?section=tools/);
  assert.match(html, /original-poster\.png/);
});

test("server-renders the Obsession photo booth on its film route", async () => {
  const response = await render("/obsession");
  assert.equal(response.status, 200);

  const html = await response.text();
  assert.match(html, /OBSESSION/);
  assert.match(html, /进入相机/);
  assert.match(html, /original-poster\.png/);
  assert.match(html, /cosmosfilm42/);
  assert.match(html, /3508 × 4961/);
  assert.match(html, /2480 × 3508/);
  assert.match(html, /直接打印 A4/);
  assert.match(html, /下载 A4 PDF/);
  assert.match(html, /保存 A3 屏幕版/);
  assert.doesNotMatch(html, /CLOUD AI/);
});

test("keeps the pose guide and its runtime assets on-device", async () => {
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

test("keeps large uploads memory-safe and renders locally", async () => {
  const page = await readFile(new URL("../app/obsession-poster.tsx", import.meta.url), "utf8");

  assert.match(page, /MAX_WORKING_PIXELS = 12_000_000/);
  assert.match(page, /prepareWorkingImage/);
  assert.doesNotMatch(page, /prepareCloudAiUpload/);
  assert.doesNotMatch(page, /\/api\/generate-poster/);
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
});

test('audience photo page is available without signing in and retains a separate admin link', async () => {
  const response = await render('/archive/upload');
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /上传活动照片/);
  assert.match(html, /无需登录/);
  assert.match(html, /等待审核/);
  assert.match(html, /href="\/archive\/admin\/"/);
  assert.doesNotMatch(html, /type="password"|name="username"/);
});
