import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const cache = new Map();
function load(name) {
  if (cache.has(name)) return cache.get(name);
  const source = readFileSync(new URL(`../app/${name}.ts`, import.meta.url), "utf8");
  const exports = {};
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("exports", "require", output)(exports, path => load(path.replace("./", "")));
  cache.set(name, exports); return exports;
}
const { orderItems, moveKey, galleryImages } = load("archive-presentation");
const { monthDays, eventHref, eventFilm } = load("archive-events");

test("calendar uses Monday-first actual dates including leap years", () => {
  const september = monthDays("2026-09");
  assert.equal(september[0], null);
  assert.equal(september[1], "2026-09-01");
  assert.equal(september.filter(Boolean).length, 30);
  assert.equal(monthDays("2024-02").filter(Boolean).length, 29);
  assert.equal(monthDays("2026-02").filter(Boolean).length, 28);
});
test("saved orders survive new uploads and removed items without changing source content", () => {
  const input = [{ id: "new" }, { id: "one" }, { id: "two" }];
  assert.deepEqual(orderItems(input, ["two", "removed", "one"], item => item.id).map(item => item.id), ["two", "one", "new"]);
  assert.deepEqual(input.map(item => item.id), ["new", "one", "two"]);
  assert.deepEqual(moveKey(["a", "b", "c"], "a", "c"), ["b", "c", "a"]);
  assert.deepEqual(moveKey(["a", "b", "c"], "c", "a"), ["c", "a", "b"]);
  const images = galleryImages([{ id: "one", image: "cover", title: "相册", layout: [{ type: "image", imageKey: "stable-key", image: "detail" }] }]);
  assert.deepEqual(images.map(item => item.key), ["one:cover", "stable-key"]);
});
test("new activity URLs retain the activity when switching content tabs and existing tools remain", () => {
  assert.equal(eventHref("new-activity", "photos"), "/archive/event/?event=new-activity&section=photos");
  assert.equal(eventHref("kill-bill", "photos"), "/archive/kill-bill/?section=photos");
  const data = { slug: "kill-bill", title: "KILL BILL", zhTitle: "杀死比尔", issue: "02", date: "2026-09-09", status: "published" };
  assert.equal(eventFilm(data).sections.tools.length, 2);
  assert.equal(eventFilm({ ...data, slug: "new" }).sections.tools.length, 0);
});
