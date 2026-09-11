const crypto = require("node:crypto");
const { sanitizeArticle } = require("./article-html");
const fileIds = html => [...new Set(Array.from(String(html).matchAll(/data-file-id="([^"]+)"/g), match => match[1]))];
const row = result => Array.isArray(result.data) ? result.data[0] : result.data;

async function convertDraft(db, cloud, uid, input, convert) {
  if (!/^[a-f0-9-]{36}$/i.test(input.requestId || "")) throw new Error("请刷新转换工具后重试");
  if (String(input.html || "").length > 500000 || String(input.url || "").length > 2000) throw new Error("内容过长，请分篇转换");
  const id = "wechat-" + crypto.createHash("sha256").update(uid + ":" + input.requestId).digest("hex").slice(0, 40);
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify([input.film, input.mode, input.title, input.html, input.url])).digest("hex");
  const ref = () => db.collection("archive_content").doc(id);
  const check = record => {
    if (record && (record.importFingerprint !== fingerprint || record.status === "hidden")) throw new Error("这次转换已保存或撤下，请开始新的转换");
    return record;
  };
  const existing = check(row(await ref().get()));
  if (existing) return refresh(existing);
  const imported = await convert();
  let stored;
  let inserted = false;
    await db.runTransaction(async tx => {
      inserted = false;
      const doc = tx.collection("archive_content").doc(id);
      const previous = check(row(await doc.get()));
      if (previous) { stored = previous; return; }
      stored = { film: input.film, section: "articles", title: imported.title, articleHtml: imported.articleHtml, meta: "公众号转入", status: "draft", createdAt: Date.now(), updatedAt: Date.now(), createdBy: uid, updatedBy: uid, layout: [], importFingerprint: fingerprint };
      await doc.set(stored); inserted = true;
    });
  if (!inserted) { const ids = fileIds(imported.articleHtml); if (ids.length) { try { await cloud.deleteFile({ fileList: ids }); } catch { console.warn("Duplicate conversion image cleanup failed"); } } }
  return inserted ? { ...imported, id, saved: true } : refresh(stored);
  async function refresh(record) {
    const ids = fileIds(record.articleHtml);
    const result = ids.length ? await cloud.getTempFileURL({ fileList: ids }) : { fileList: [] };
    const urls = new Map((result.fileList || []).map(item => [item.fileID, item.tempFileURL]));
    if (ids.some(id => !urls.get(id))) throw new Error("草稿已保存，图片链接暂时无法加载，请进入图文内容查看");
    return { id, saved: true, title: record.title, articleHtml: sanitizeArticle(record.articleHtml, urls), images: ids.length };
  }
}
module.exports = { convertDraft };
