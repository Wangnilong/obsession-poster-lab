// This script is injected only into the dedicated admin path, never into articles.
window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== location.origin) return;
  const { type, id, request } = event.data || {};
  if (!["cosmos-wechat-request", "cosmos-wechat-saved"].includes(type) || typeof request !== "string" || request.length > 64) return;
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id) || location.hash !== "#wechat-clip=" + id) return;
  chrome.runtime.sendMessage({ type: type === "cosmos-wechat-request" ? "get-article" : "saved-article", id })
    .then(result => window.postMessage({ type: type === "cosmos-wechat-request" ? "cosmos-wechat-result" : "cosmos-wechat-cleared", id, request, ...result }, location.origin))
    .catch(() => window.postMessage({ type: "cosmos-wechat-result", id, request, error: "插件连接已断开，请刷新后台后重试。" }, location.origin));
});
