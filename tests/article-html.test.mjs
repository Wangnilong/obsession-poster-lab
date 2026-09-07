import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { sanitizeArticle } = require("../cloudfunctions/archive-api/article-html.js");

test("article publishing preserves formatting and refreshes stored image URLs", () => {
  const html = sanitizeArticle('<h2 style="text-align:center">标题</h2><p><b>粗体</b><span style="color:#ff0000;font-size:20px">正文</span></p><img data-file-id="cloud://photo" src="https://expired.example/photo" style="width:50%">', new Map([["cloud://photo", "https://current.example/photo"]]));
  assert.match(html, /text-align:center/);
  assert.match(html, /<b>粗体<\/b>/);
  assert.match(html, /color:#ff0000/);
  assert.match(html, /https:\/\/current.example\/photo/);
  assert.doesNotMatch(html, /expired.example/);
});

test("article publishing removes executable content and unsafe CSS", () => {
  const html = sanitizeArticle('<script>alert(1)</script><img src="https://example.com/a" onerror="alert(2)"><a href="javascript:alert(3)">链接</a><p style="position:fixed;background-image:url(https://evil.example);color:red">文本</p><iframe src="https://evil.example"></iframe>');
  assert.doesNotMatch(html, /script|onerror|javascript|position|background-image|iframe|evil.example/);
  assert.match(html, /color:red/);
});
