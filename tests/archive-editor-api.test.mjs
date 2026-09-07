import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const require = createRequire(new URL("../cloudfunctions/archive-api/index.js", import.meta.url));
const source = readFileSync(new URL("../cloudfunctions/archive-api/index.js", import.meta.url), "utf8");
function service(uid) {
  const records = new Map();
  let serial = 0;
  const cloud = {
    auth: () => ({ getUserInfo: () => ({ uid }) }),
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(fileID => ({ fileID, tempFileURL: `https://images.example/${encodeURIComponent(fileID)}` })) }),
    database: () => ({ collection: () => {
      let filter = {}, offset = 0, limit = 100;
      const query = {
        where(value) { filter = value; return query; }, orderBy() { return query; }, skip(value) { offset = value; return query; }, limit(value) { limit = value; return query; },
        async get() { return { data: [...records.values()].filter(record => Object.entries(filter).every(([key, value]) => record[key] === value)).slice(offset, offset + limit) }; },
        async add(record) { const id = String(++serial); records.set(id, { ...record, _id: id }); return { id }; },
        doc(id) { return { get: async () => ({ data: records.has(id) ? [records.get(id)] : [] }), update: async update => { records.set(id, { ...records.get(id), ...update }); } }; },
      }; return query;
    } }),
  };
  const exports = {};
  vm.runInNewContext(source, { require: name => name === "@cloudbase/node-sdk" ? { init: () => cloud } : require(name), exports, console: { error() {}, warn() {} }, Buffer });
  return { run: exports.main, records };
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
