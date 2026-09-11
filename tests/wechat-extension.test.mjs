import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { createRequire } from "node:module";
import { parseHTML } from "linkedom";
import { readArticle } from "../extensions/wechat-importer/article.js";
const require = createRequire(import.meta.url);
const { parseWechatContent, importWechatContent } = require("../cloudfunctions/archive-api/wechat.js");
const source = "https://mp.weixin.qq.com/s/LSWAUTzlQGAzGIFchq6Kxg";
const ADMIN = "https://cosmosfilm42-admin-d8c82218a2fad-1325477277.tcloudbaseapp.com/archive/admin/";
function extract(html, url = source) {
  const { document } = parseHTML(html);
  return vm.runInNewContext(`(${readArticle.toString()})()`, { document, location: new URL(url), URL });
}
const fixture = `<h1 id="activity-name">电影 · 时时刻刻</h1><div id="js_content" style="visibility:hidden"><section class="wx" onclick="evil()"><p style="color:red">第一段</p><img data-src="//mmbiz.qpic.cn/example.jpg" src="data:image/gif;base64,placeholder" onerror="evil()" style="opacity:0;height:0px"><p>第二段</p><iframe src="https://evil.example"></iframe><script>evil()</script><img data-src="https://mmbiz.qpic.cn/example.jpg"></section></div>`;

test("browser extraction preserves paragraph order, lazy images and embedded-media position", () => {
  const article = extract(fixture);
  assert.equal(article.title, "电影 · 时时刻刻");
  assert.equal(article.images, 1);
  assert.match(article.html, /第一段[\s\S]+example.jpg[\s\S]+第二段[\s\S]+公众号原文/);
  assert.doesNotMatch(article.html, /script|onclick|onerror|iframe|opacity|data-src|evil|placeholder/);
  const parsed = parseWechatContent(article);
  assert.equal(parsed.images.length, 1);
  assert.equal(parsed.sourceUrl, source);
});
test("extraction stops at verification pages, empty articles, foreign origins and image limits", () => {
  assert.ok(extract("<p>请完成验证</p>", "https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha").error);
  assert.ok(extract(fixture, "https://evil.example/s/article").error);
  assert.ok(extract('<h1 id="activity-name">Empty</h1><div id="js_content"></div>').error);
  assert.ok(extract(fixture.replaceAll("mmbiz.qpic.cn", "127.0.0.1")).error);
  assert.ok(extract(`<h1 id="activity-name">Many</h1><div id="js_content">${Array.from({ length: 41 }, (_, i) => `<img src="https://mmbiz.qpic.cn/${i}.jpg">`).join("")}</div>`).error);
});
test("extracted content uses existing image storage and does not fetch the blocked article", async () => {
  let uploads = 0;
  const result = await importWechatContent({
    uploadFile: async () => { uploads++; return { fileID: "cloud://stored" }; },
    getTempFileURL: async () => ({ fileList: [{ fileID: "cloud://stored", tempFileURL: "https://storage.example/image.jpg" }] }),
  }, extract(fixture), "shishikeke", async (url, options) => {
    assert.equal(url, "https://mmbiz.qpic.cn/example.jpg"); assert.equal(options.image, true);
    return { buffer: Buffer.from("image fixture"), type: "image/jpeg" };
  });
  assert.equal(uploads, 1);
  assert.equal(result.images, 1);
  assert.match(result.articleHtml, /data-file-id="cloud:\/\/stored"/);
});

async function background(existing = true) {
  const storage = {}; const tabs = []; let handler;
  const chrome = {
    runtime: { id: "fixture", getURL: path => "chrome-extension://fixture/" + path, onMessage: { addListener: cb => { handler = cb; } } },
    storage: { local: {
      get: async key => structuredClone(key === null ? storage : { [key]: storage[key] }),
      set: async value => Object.assign(storage, structuredClone(value)),
      remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key]; },
    } },
    tabs: {
      query: async () => existing ? [{ id: 42, windowId: 1, active: true }] : [],
      update: async (id, change) => { tabs.push(change); return { id, windowId: 1 }; },
      create: async change => { tabs.push(change); return { id: 43, windowId: 1 }; },
    },
    windows: { update: async () => {} },
  };
  vm.runInNewContext(await readFile(new URL("../extensions/wechat-importer/background.js", import.meta.url), "utf8"), { chrome, crypto: webcrypto, URL, Date });
  const send = (message, sender) => new Promise(resolve => handler(message, sender, resolve));
  const queue = () => send({ type: "queue-article", article: extract(fixture) }, { id: "fixture", url: chrome.runtime.getURL("popup.html") });
  const sender = id => ({ id: "fixture", frameId: 0, tab: { id: existing ? 42 : 43 }, url: ADMIN + "#wechat-clip=" + id });
  return { storage, tabs, send, queue, sender, chrome };
}
test("imports survive login/refresh and are removed only after successful draft save", async () => {
  const bg = await background();
  assert.equal((await bg.queue()).ok, true);
  const id = new URL(bg.tabs[0].url).hash.slice("#wechat-clip=".length);
  for (let retry = 0; retry < 2; retry++) {
    const result = await bg.send({ type: "get-article", id }, bg.sender(id));
    assert.equal(result.article.title, "电影 · 时时刻刻");
    assert.equal(Object.keys(bg.storage).length, 1);
  }
  assert.equal((await bg.send({ type: "saved-article", id }, bg.sender(id))).ok, true);
  assert.equal(Object.keys(bg.storage).length, 0);
});
test("only the corresponding admin tab can read or acknowledge a clip", async () => {
  const bg = await background(false); await bg.queue();
  const id = new URL(bg.tabs[0].url).hash.slice("#wechat-clip=".length);
  for (const sender of [
    { ...bg.sender(id), url: "https://evil.example/#wechat-clip=" + id },
    { ...bg.sender(id), frameId: 1 },
    { ...bg.sender(id), tab: { id: 99 } },
    { ...bg.sender(id), id: "other-extension" },
  ]) assert.ok((await bg.send({ type: "get-article", id }, sender)).error);
  assert.equal((await bg.send({ type: "get-article", id }, bg.sender(id))).ok, true);
  const unauthorized = await bg.send({ type: "queue-article", article: extract(fixture) }, bg.sender(id));
  assert.ok(unauthorized.error);
});
test("expired clips cannot be retrieved and failed tab opens do not leave orphan imports", async () => {
  const bg = await background(); await bg.queue();
  const [key] = Object.keys(bg.storage); const id = key.slice("article:".length);
  bg.storage[key].createdAt = Date.now() - 25 * 60 * 60 * 1000;
  assert.ok((await bg.send({ type: "get-article", id }, bg.sender(id))).error);
  assert.equal(Object.keys(bg.storage).length, 0);
  bg.chrome.tabs.update = async () => { throw new Error("Tab was closed"); };
  assert.ok((await bg.queue()).error);
  assert.equal(Object.keys(bg.storage).length, 0);
});
test("bridge checks origin and exact import id before accessing extension storage", async () => {
  let listener; const sent = []; const replies = [];
  const id = webcrypto.randomUUID();
  const location = new URL(ADMIN + "#wechat-clip=" + id);
  const window = { addEventListener: (_, cb) => { listener = cb; }, postMessage: data => replies.push(data) };
  vm.runInNewContext(await readFile(new URL("../extensions/wechat-importer/bridge.js", import.meta.url), "utf8"), {
    window, location, chrome: { runtime: { sendMessage: async data => { sent.push(data); return { ok: true, article: { title: "Imported" } }; } } },
  });
  const event = { source: window, origin: location.origin, data: { type: "cosmos-wechat-request", id, request: "request-1" } };
  listener({ ...event, origin: "https://evil.example" });
  listener({ ...event, source: {} });
  listener({ ...event, data: { ...event.data, id: webcrypto.randomUUID() } });
  assert.equal(sent.length, 0);
  listener(event); await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.length, 1); assert.equal(replies[0].article.title, "Imported");
});
