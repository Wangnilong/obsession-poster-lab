const ADMIN = "https://cosmosfilm42-admin-d8c82218a2fad-1325477277.tcloudbaseapp.com/archive/admin/";
const TTL = 24 * 60 * 60 * 1000;
const validId = id => typeof id === "string" && /^[a-f0-9-]{36}$/.test(id);
const key = id => `article:${id}`;
function isAdminPage(value) {
  try {
    const url = new URL(value);
    return url.origin === new URL(ADMIN).origin && url.pathname === "/archive/admin/" && !url.username && !url.password;
  } catch { return false; }
}
function validArticle(value) {
  if (!value || typeof value.title !== "string" || !value.title.trim() || value.title.length > 200 || typeof value.html !== "string" || !value.html.trim() || value.html.length > 500000) return false;
  try { const u = new URL(value.url); return u.protocol === "https:" && u.hostname === "mp.weixin.qq.com" && !u.username && !u.password && !u.port && /^\/s(?:\/|$)/.test(u.pathname); } catch { return false; }
}
async function handle(message, sender) {
  if (message?.type === "queue-article") {
    if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL("popup.html") || !validArticle(message.article)) throw new Error("导入内容无效，请回到文章页面重试。");
    const stored = await chrome.storage.local.get(null);
    const entries = Object.entries(stored).filter(([name]) => name.startsWith("article:"));
    const expired = entries.filter(([, record]) => !record.createdAt || Date.now() - record.createdAt > TTL).map(([name]) => name);
    if (expired.length) await chrome.storage.local.remove(expired);
    if (entries.length - expired.length >= 10) throw new Error("还有 10 篇待保存文章，请先在后台完成导入；暂存内容会在 24 小时后过期。");
    const id = crypto.randomUUID();
    const tabs = await chrome.tabs.query({ url: ADMIN + "*" });
    const existing = tabs.find(tab => tab.active) || tabs[0];
    // Bind the destination before navigation can mount the receiving page.
    const destination = existing || await chrome.tabs.create({ url: "about:blank", active: false });
    try {
      await chrome.storage.local.set({ [key(id)]: { article: message.article, createdAt: Date.now(), tabId: destination.id } });
      const target = await chrome.tabs.update(destination.id, { url: ADMIN + "#wechat-clip=" + id, active: true });
      if (target.windowId != null) await chrome.windows.update(target.windowId, { focused: true }).catch(() => {});
      return { ok: true };
    } catch (error) { await chrome.storage.local.remove(key(id)); throw error; }
  }
  if (!["get-article", "saved-article"].includes(message?.type) || !validId(message.id)) throw new Error("无效请求");
  // Sender metadata may omit or retain an older fragment after same-document
  // navigation. Authorize the admin document and bound tab, not that fragment.
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !isAdminPage(sender.url) || sender.tab?.id == null) throw new Error("只能从对应的宇宙放映后台接收文章。");
  const currentTab = await chrome.tabs.get(sender.tab.id);
  if (!isAdminPage(currentTab.url)) throw new Error("后台标签页已跳转，请回到文章重新导入。");
  const record = (await chrome.storage.local.get(key(message.id)))[key(message.id)];
  if (!record || Date.now() - record.createdAt > TTL) { await chrome.storage.local.remove(key(message.id)); throw new Error("暂存文章已过期，请回到原文重新点插件导入。"); }
  if (record.tabId !== sender.tab.id) throw new Error("请在插件打开的后台标签页继续导入。");
  if (message.type === "saved-article") { await chrome.storage.local.remove(key(message.id)); return { ok: true }; }
  return { ok: true, article: record.article };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(respond).catch(error => respond({ error: error.message || "导入失败，请重试。" }));
  return true;
});
