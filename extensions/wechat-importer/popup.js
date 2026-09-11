import { readArticle } from "./article.js";
const status = document.getElementById("status");
const button = document.getElementById("import");
const retry = document.getElementById("retry");
let article;
async function read() {
  article = null; button.disabled = true; retry.disabled = true; status.className = "";
  status.textContent = "正在读取当前文章…";
  document.getElementById("title").textContent = ""; document.getElementById("details").textContent = "";
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url?.startsWith("https://mp.weixin.qq.com/")) throw new Error("请先在浏览器中打开公众号文章，再点击这个插件。");
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: readArticle });
    if (!result || result.error) throw new Error(result?.error || "未读取到正文，请刷新文章后重试。");
    article = result; status.textContent = "文章已就绪";
    document.getElementById("title").textContent = article.title;
    document.getElementById("details").textContent = `${article.images} 张图片 · 标题与图文一起导入`;
    button.disabled = false;
  } catch (error) { status.textContent = error.message || "读取失败，请重新打开文章。"; status.className = "error"; }
  finally { retry.disabled = false; }
}
button.addEventListener("click", async () => {
  if (!article) return;
  button.disabled = true; retry.disabled = true; status.textContent = "正在打开后台…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "queue-article", article });
    if (!result?.ok) throw new Error(result?.error || "导入失败，请重试。");
    window.close();
  } catch (error) { status.textContent = error.message; status.className = "error"; button.disabled = false; retry.disabled = false; }
});
retry.addEventListener("click", read);
void read();
