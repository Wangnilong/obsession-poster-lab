import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(new URL("../cloudfunctions/archive-api/index.js", import.meta.url));
const source = readFileSync(new URL("../cloudfunctions/archive-api/index.js", import.meta.url), "utf8");
function service(uid) {
  const records = new Map();
  const uploads = [];
  let serial = 0;
  const cloud = {
    uploadFile: async input => { uploads.push(input); return { fileID: `cloud://test/${input.cloudPath}` }; },
    deleteFile: async () => ({}),
    auth: () => ({ getUserInfo: () => ({ uid }) }),
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(fileID => ({ fileID, tempFileURL: `https://images.example/${encodeURIComponent(fileID)}` })) }),
    database: () => database,
  };
  const database = { runTransaction: async callback => callback(database), collection: () => {
      let filter = {}, offset = 0, limit = 100;
      const query = {
        where(value) { filter = value; return query; }, orderBy() { return query; }, skip(value) { offset = value; return query; }, limit(value) { limit = value; return query; },
        async get() { return { data: [...records.values()].filter(record => Object.entries(filter).every(([key, value]) => record[key] === value)).slice(offset, offset + limit) }; },
        async add(record) { const id = String(++serial); records.set(id, { ...record, _id: id }); return { id }; },
        doc(id) { return { remove: async () => { records.delete(id); }, get: async () => ({ data: records.has(id) ? [records.get(id)] : [] }), set: async record => { records.set(id, { ...record, _id: id }); }, update: async update => { records.set(id, { ...records.get(id), ...update }); } }; },
      }; return query;
    },
  };
  const exports = {};
  vm.runInNewContext(source, { require: name => name === "@cloudbase/node-sdk" ? { init: () => cloud } : require(name), exports, console: { error() {}, warn() {} }, Buffer });
  return { run: exports.main, records, uploads };
}
test("editor API requires authenticated content role and restricts photo uploader", async () => {
  const guest = service("");
  assert.equal((await guest.run({ action: "editor-list", film: "kill-bill", section: "photos" })).ok, false);
  const uploader = service("2084617329225424898");
  assert.equal((await uploader.run({ action: "editor-list", film: "kill-bill", section: "articles" })).ok, false);
  assert.equal((await uploader.run({ action: "editor-hide", id: "1" })).ok, false);
  assert.equal((await uploader.run({ action: "editor-save", record: { film: "kill-bill", section: "photos", title: "photo", fileID: "cloud://photo", status: "published" } })).ok, true);
});
test("drafts stay private, publishing preserves formatting, and later pending edits stay private", async () => {
  const { run } = service("2084617266415722497");
  const record = { film: "kill-bill", section: "articles", title: "Test article", status: "draft", createdAt: 1, articleHtml: "<p><b>Published text</b></p>" };
  const saved = await run({ action: "editor-save", record });
  assert.equal(saved.ok, true);
  const read = async () => JSON.parse((await run({ httpMethod: "GET", queryStringParameters: { film: "kill-bill", section: "articles" } })).body);
  assert.equal((await read()).entries.length, 0);
  assert.equal((await run({ action: "editor-save", record: { ...record, _id: saved.id, status: "published", pendingHtml: "<p>Unpublished edit</p>" } })).ok, true);
  const entries = (await read()).entries;
  assert.equal(entries.length, 1);
  assert.match(entries[0].articleHtml, /<b>Published text<\/b>/);
  assert.doesNotMatch(JSON.stringify(entries), /Unpublished edit/);
  await run({ action: "editor-hide", id: saved.id });
  assert.equal((await read()).entries.length, 0);
});

test("Word formatting survives draft, reopen, publish and republish without changing other records", async () => {
  const { run, records } = service("2084617266415722497");
  const html = '<p style="text-indent:2em;line-height:1.5;margin-bottom:1em"><span style="font-size:14pt;background-color:#fff09b">正文</span></p><table><tbody><tr><td>场次</td><td>时间</td></tr></tbody></table>';
  const record = { film: "obsession", section: "articles", title: "排版测试", status: "draft", articleHtml: html, createdBy: "editor", createdAt: 5 };
  const other = await run({ action: "editor-save", record: { ...record, title: "另一篇" } });
  const untouched = JSON.stringify(records.get(other.id));
  const saved = await run({ action: "editor-save", record });
  const reopened = (await run({ action: "editor-list", film: "obsession", section: "articles" })).records.find(item => item._id === saved.id);
  for (const format of ["text-indent:2em", "line-height:1.5", "margin-bottom:1em", "font-size:14pt", "<table>"]) assert.ok(reopened.articleHtml.includes(format));
  await run({ action: "editor-save", record: { ...reopened, status: "published", pendingTitle: "待发布", pendingHtml: "", pendingCopy: "" } });
  const read = async () => JSON.parse((await run({ httpMethod: "GET", queryStringParameters: { film: "obsession", section: "articles" } })).body).entries;
  const live = (await read())[0];
  assert.equal(live.title, "排版测试");
  assert.match(live.articleHtml, /text-indent:2em/);
  assert.doesNotMatch(JSON.stringify(live), /pendingTitle|待发布/);
  await run({ action: "editor-save", record: { ...reopened, status: "published", title: "新版", pendingTitle: "", articleHtml: '<h2 style="text-align:center">新标题</h2>' } });
  assert.equal((await read())[0].title, "新版");
  assert.equal(JSON.stringify(records.get(other.id)), untouched);
});
const { defaultPresentation, imageKeys } = require('./presentation');
const { checkedUrl, parseWechat, importWechat } = require('./wechat');
const publicRead = async (run, query) => { const response = await run({ httpMethod: 'GET', queryStringParameters: query }); return { status: response.statusCode, ...JSON.parse(response.body) }; };

test('layout changes keep content intact and reject stale revisions and foreign keys', async () => {
  const { run, records } = service('2084617266415722497');
  const saved = await run({ action: 'editor-save', record: { film: 'kill-bill', section: 'photos', status: 'published', title: '现场', fileID: 'cloud://photo', layout: [{ type: 'image', fileID: 'cloud://detail' }] } });
  const snapshot = JSON.stringify(records.get(saved.id));
  const live = await publicRead(run, { film: 'kill-bill', section: 'photos' });
  const entry = live.entries[0];
  const config = { ...defaultPresentation(), posterFileID: 'cloud://environment/archive/kill-bill/covers/poster.jpg', posterX: 30, posterY: 70, sectionOrder: ['photos', 'merch', 'articles', 'tools'], itemOrders: { articles: [], photos: [entry.layout[0].imageKey, entry.imageKey], merch: [], tools: ['tool:1', 'tool:0'] } };
  const result = await run({ action: 'presentation-save', film: 'kill-bill', presentation: config });
  assert.equal(result.ok, true, result.message);
  assert.equal(result.presentation.revision, 1);
  assert.match(result.presentation.poster, /^https:/);
  assert.equal(JSON.stringify(records.get(saved.id)), snapshot);
  assert.equal((await publicRead(run, { film: 'kill-bill', section: 'photos' })).presentation.posterX, 30);
  assert.equal((await run({ action: 'presentation-save', film: 'kill-bill', presentation: config })).ok, false);
  const invalid = { ...result.presentation, itemOrders: { ...config.itemOrders, photos: ['foreign-record:cover'] } };
  assert.equal((await run({ action: 'presentation-save', film: 'kill-bill', presentation: invalid })).ok, false);
  assert.equal((await run({ action: 'presentation-get', film: 'kill-bill' })).presentation.revision, 1);
  const otherFilm = { ...result.presentation, posterFileID: 'cloud://environment/archive/obsession/covers/poster.jpg' };
  assert.equal((await run({ action: 'presentation-save', film: 'kill-bill', presentation: otherFilm })).ok, false);
  const keys = imageKeys({ _id: 'a', layout: [{ type: 'image', fileID: 'same' }, { type: 'paragraph' }, { type: 'image', fileID: 'same' }] });
  assert.notEqual(keys[0], keys[2]);
});

test('only administrators can change events, layouts, or import articles', async () => {
  for (const uid of ['', '2084617329225424898']) {
    const { run } = service(uid);
    for (const action of ['events-get', 'events-save', 'presentation-get', 'presentation-save', 'event-preview', 'import-wechat']) assert.equal((await run({ action, film: 'kill-bill' })).ok, false, action);
  }
});

test('new activity drafts, publication, ordering and private content preview round trip', async () => {
  const { run } = service('2084617266415722497');
  const start = (await run({ action: 'events-get' })).catalog;
  const created = { slug: 'screening-test', title: 'TEST', zhTitle: '测试活动', issue: '03', date: '2026-09-09', location: '影院', summary: '简介', status: 'draft' };
  const config = { ...start, events: [created, ...start.events] };
  const saved = await run({ action: 'events-save', catalog: config });
  assert.equal(saved.ok, true, saved.message);
  assert.equal((await publicRead(run, { action: 'events' })).events.length, 2);
  assert.equal((await run({ action: 'events-save', catalog: config })).ok, false);
  const photo = await run({ action: 'editor-save', record: { film: created.slug, title: '照片', section: 'photos', fileID: 'cloud://photo', status: 'published' } });
  assert.equal(photo.ok, true, photo.message);
  assert.equal((await publicRead(run, { film: created.slug, section: 'photos' })).status, 400);
  const preview = await run({ action: 'event-preview', film: created.slug, section: 'photos' });
  assert.equal(preview.ok, true);
  assert.equal(preview.document.entries.length, 1);
  const layout = await run({ action: 'presentation-save', film: created.slug, presentation: { ...defaultPresentation(), itemOrders: { articles: [], photos: [photo.id + ':cover'], merch: [], tools: [] } } });
  assert.equal(layout.ok, true, layout.message);
  const published = { ...saved.catalog, events: [{ ...created, status: 'published' }, ...start.events] };
  assert.equal((await run({ action: 'events-save', catalog: published })).ok, true);
  assert.equal((await publicRead(run, { action: 'events' })).events[0].slug, created.slug);
  assert.equal((await publicRead(run, { film: created.slug, section: 'photos' })).entries.length, 1);
  const latest = (await run({ action: 'events-get' })).catalog;
  assert.equal((await run({ action: 'events-save', catalog: { ...latest, events: latest.events.slice(1) } })).ok, false);
  const invalid = { ...latest, events: latest.events.map(item => item.slug === created.slug ? { ...item, date: '2026-02-30' } : item) };
  assert.equal((await run({ action: 'events-save', catalog: invalid })).ok, false);
});

test('WeChat conversion extracts the article, stores images, and sanitizes scripts', async () => {
  const html = '<h1 id="activity-name">放映回顾 &amp; 记录</h1><div id="js_content"><section><p style="text-align:center">正文</p><img data-src="https://mmbiz.qpic.cn/a" onerror="alert(1)"><script>alert(1)</script></section></div><p>页面广告</p>';
  assert.equal(parseWechat(html).title, '放映回顾 & 记录');
  assert.throws(() => parseWechat('<p>请完成验证</p>'), /正文/);
  for (const url of ['http://mp.weixin.qq.com/s/a', 'https://127.0.0.1/s/a', 'https://mp.weixin.qq.com.evil.test/s/a', 'https://user:password@mp.weixin.qq.com/s/a']) assert.throws(() => checkedUrl(url));
  assert.throws(() => parseWechat('<div id="js_content"><img src="https://127.0.0.1/private"></div>'));
  const uploaded = [];
  const cloud = { uploadFile: async item => { uploaded.push(item); return { fileID: 'cloud://stored' }; }, getTempFileURL: async () => ({ fileList: [{ fileID: 'cloud://stored', tempFileURL: 'https://stored.example/photo' }] }) };
  const result = await importWechat(cloud, 'https://mp.weixin.qq.com/s/example', 'kill-bill', async (url, options) => options.image ? { buffer: Buffer.from('test image'), type: 'image/jpeg' } : { buffer: Buffer.from(html), type: 'text/html' });
  assert.equal(result.images, 1);
  assert.match(uploaded[0].cloudPath, /^archive\/kill-bill\/articles\/wechat-/);
  assert.match(result.articleHtml, /data-file-id="cloud:\/\/stored"/);
  assert.match(result.articleHtml, /text-align:center/);
  assert.match(result.articleHtml, /公众号原文/);
  assert.doesNotMatch(result.articleHtml, /onerror|script|alert\(1\)|页面广告/);
  const textOnly = await importWechat({}, 'https://mp.weixin.qq.com/s/text', 'kill-bill', async () => ({ buffer: Buffer.from('<h1 id="activity-name">文字文章</h1><div id="js_content"><p>只有正文</p></div>') }));
  assert.equal(textOnly.images, 0);
  assert.match(textOnly.articleHtml, /只有正文/);
});
const jpeg = Buffer.from([255,216,255,192,0,17,8,0,2,0,2,3,1,17,0,2,17,0,3,17,0,255,217]);
const photoInput = { film: 'kill-bill', submissionId: 'b6e7a130-8af0-45f2-bc64-cdc88a550994', displayName: '观众', caption: '现场照片', consent: true, imageData: 'data:image/jpeg;base64,' + jpeg.toString('base64'), status: 'published' };
const submitPhoto = (run, input = photoInput, origin = 'https://cosmosfilm42.cn') => run({ httpMethod: 'POST', headers: { origin }, queryStringParameters: { action: 'submit-photo' }, body: JSON.stringify(input) });

test('public photo submissions stay private, retries never republish, and admin approval/retraction is atomic', async () => {
  const { run, uploads, records } = service('2084617266415722497');
  const first = await submitPhoto(run);
  assert.equal(first.statusCode, 201, first.body);
  assert.doesNotMatch(first.body, /fileID|image|cloud:\/\//);
  assert.equal((await publicRead(run, { film: 'kill-bill', section: 'photos' })).entries.length, 0);
  assert.equal((await run({ action: 'editor-list', film: 'kill-bill', section: 'photos' })).records.length, 0);
  const pending = await run({ action: 'photo-submissions-list', status: 'pending' });
  assert.equal(pending.items.length, 1);
  assert.match(pending.items[0].image, /^https:/);
  assert.equal((await submitPhoto(run)).statusCode, 201);
  assert.equal(uploads.length, 1);
  const item = pending.items[0];
  assert.equal((await run({ action: 'photo-submissions-review', id: item.id, revision: 0, status: 'approved' })).ok, true);
  const published = await publicRead(run, { film: 'kill-bill', section: 'photos' });
  assert.equal(published.entries.length, 1);
  assert.equal(published.entries[0].title, '现场照片');
  assert.equal((await run({ action: 'photo-submissions-review', id: item.id, revision: 0, status: 'rejected' })).ok, false);
  assert.equal((await run({ action: 'photo-submissions-review', id: item.id, revision: 1, status: 'rejected' })).ok, true);
  assert.equal((await publicRead(run, { film: 'kill-bill', section: 'photos' })).entries.length, 0);
  assert.equal((await submitPhoto(run)).statusCode, 201);
  assert.equal(records.get(item.id).status, 'rejected');
  assert.equal(uploads.length, 1);
  assert.equal((await submitPhoto(run, { ...photoInput, caption: 'changed' })).statusCode, 400);
});

test('anonymous submissions require explicit consent and valid photo while moderation stays admin-only', async () => {
  const { run, uploads } = service('');
  assert.equal((await submitPhoto(run)).statusCode, 201);
  for (const uid of ['', '2084617329225424898']) {
    const restricted = service(uid);
    for (const action of ['photo-submissions-list', 'photo-submissions-review']) assert.equal((await restricted.run({ action, status: 'pending' })).ok, false);
  }
  assert.equal((await submitPhoto(run, photoInput, 'https://untrusted.example')).statusCode, 403);
  for (const change of [{ consent: false }, { film: 'non-existent' }, { imageData: 'data:image/jpeg;base64,' + Buffer.from('fake').toString('base64') }, { imageData: 'x'.repeat(1500000) }]) assert.equal((await submitPhoto(run, { ...photoInput, ...change })).statusCode, 400);
  assert.equal(uploads.length, 1);
});

test('chunked uploads resume safely, verify integrity, and keep photos private until review', async () => {
  const { run, records, uploads } = service('');
  const identity = { submissionId: photoInput.submissionId, uploadToken: 'ddba0f1e-daa9-461d-aa5a-6fd5f202dcdb' };
  const contentHash = require('node:crypto').createHash('sha256').update(photoInput.imageData).digest('hex');
  const post = (action, input) => run({ httpMethod: 'POST', headers: { origin: 'https://cosmosfilm42.cn' }, queryStringParameters: { action }, body: JSON.stringify(input) });
  const start = { ...photoInput, ...identity, imageData: undefined, parts: 2, contentHash };
  assert.equal((await post('photo-upload-start', { ...start, consent: 'false' })).statusCode, 400);
  assert.equal((await post('photo-upload-start', start)).statusCode, 201);
  const encoded = jpeg.toString('base64'), split = 12;
  assert.equal((await post('photo-upload-part', { ...identity, index: 0, chunk: encoded.slice(0, split) })).statusCode, 201);
  assert.equal((await post('photo-upload-finish', identity)).statusCode, 400);
  assert.equal((await post('photo-upload-part', { ...identity, uploadToken: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', index: 1, chunk: encoded.slice(split) })).statusCode, 400);
  assert.equal((await post('photo-upload-start', start)).statusCode, 201);
  assert.equal((await post('photo-upload-part', { ...identity, index: 0, chunk: encoded.slice(0, split) })).statusCode, 201);
  assert.equal((await post('photo-upload-part', { ...identity, index: 1, chunk: encoded.slice(split) })).statusCode, 201);
  const finished = await post('photo-upload-finish', identity);
  assert.equal(finished.statusCode, 201, finished.body);
  assert.equal((await post('photo-upload-finish', identity)).statusCode, 201);
  assert.equal(uploads.length, 1);
  assert.equal([...records.values()].filter(row => row.section === 'photo-upload-part').length, 0);
  assert.equal([...records.values()].filter(row => row.section === 'photo-submissions' && row.status === 'pending').length, 1);
  assert.equal((await publicRead(run, { film: 'kill-bill', section: 'photos' })).entries.length, 0);
});

test('ticket links persist with activities and reject executable URL schemes', async () => {
  const { run } = service('2084617266415722497');
  const catalog = (await run({ action: 'events-get' })).catalog;
  const ticketUrl = 'https://wxaurl.cn/example';
  const result = await run({ action: 'events-save', catalog: { ...catalog, events: catalog.events.map(item => ({ ...item, ticketUrl })) } });
  assert.equal(result.ok, true, result.message);
  assert.equal((await publicRead(run, { action: 'events' })).events[0].ticketUrl, ticketUrl);
  const invalid = { ...result.catalog, events: result.catalog.events.map(item => ({ ...item, ticketUrl: 'javascript:alert(1)' })) };
  assert.equal((await run({ action: 'events-save', catalog: invalid })).ok, false);
  const scheme = { ...result.catalog, events: result.catalog.events.map(item => ({ ...item, ticketUrl: 'weixin://dl/business/?t=example' })) };
  assert.equal((await run({ action: 'events-save', catalog: scheme })).ok, true);
});
