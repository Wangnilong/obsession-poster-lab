const https = require("node:https");
const crypto = require("node:crypto");
const { parseDocument } = require("htmlparser2");
const sanitize = require("sanitize-html");
const { sanitizeArticle } = require("./article-html");
const articleFormat = require("./article-format.json");
const imageHosts = new Set(["mmbiz.qpic.cn", "mmbiz.qlogo.cn", "mmecoa.qpic.cn", "wx.qlogo.cn"]);

function checkedUrl(input, image = false) {
  let url;
  try { url = new URL(input); } catch { throw new Error("请输入完整的公众号文章链接"); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || (image ? !imageHosts.has(url.hostname) : url.hostname !== "mp.weixin.qq.com" || !/^\/s(?:\/|$)/.test(url.pathname))) throw new Error(image ? "文章包含不支持自动转存的外部图片，请手动上传" : "请使用 mp.weixin.qq.com 的文章链接");
  return url;
}
function download(input, { image = false, max = 3 * 1024 * 1024, deadline = Date.now() + 12000, redirects = 0 } = {}) {
  const url = checkedUrl(input, image);
  if (Date.now() >= deadline) return Promise.reject(new Error("公众号读取超时，请稍后重试"));
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: image ? "image/*" : "text/html" } }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (!response.headers.location || redirects >= 3) { reject(new Error("公众号链接跳转过多，请使用文章原链接")); return; }
        try { resolve(download(new URL(response.headers.location, url).href, { image, max, deadline, redirects: redirects + 1 })); } catch (error) { reject(error); }
        return;
      }
      if (response.statusCode !== 200) { response.resume(); reject(new Error("微信暂时不允许读取这篇文章，可复制正文到图文编辑器")); return; }
      const chunks = []; let size = 0;
      response.on("data", chunk => { size += chunk.length; if (size > max) request.destroy(new Error("文章或图片过大，请手动导入")); else chunks.push(chunk); });
      response.on("end", () => resolve({ buffer: Buffer.concat(chunks), type: String(response.headers["content-type"] || "").split(";")[0] }));
      response.on("error", reject);
    });
    const timer = setTimeout(() => request.destroy(new Error("公众号读取超时，请稍后重试")), Math.min(12000, deadline - Date.now()));
    request.on("close", () => clearTimeout(timer)); request.on("error", reject);
  });
}
function parseWechat(html) {
  const doc = parseDocument(html, { withStartIndices: true, withEndIndices: true });
  let body, title;
  const find = node => { if (node.attribs?.id === "js_content") body = node; if (node.attribs?.id === "activity-name") title = node; node.children?.forEach(find); };
  find(doc);
  if (!body) throw new Error("微信未返回文章正文，可能需要验证。请复制正文到图文编辑器后保存草稿。");
  const text = node => node?.type === "text" ? node.data : (node?.children || []).map(text).join("");
  const images = [];
  const gather = node => { if (node.name === "img") { const src = node.attribs["data-src"] || node.attribs.src; if (src) images.push(src.startsWith("//") ? `https:${src}` : src.replace(/^http:/, "https:")); } node.children?.forEach(gather); };
  gather(body);
  const unique = [...new Set(images)];
  if (unique.length > 40) throw new Error("文章超过 40 张图片，请分篇导入或复制正文后上传图片");
  unique.forEach(src => checkedUrl(src, true));
  return { title: text(title).trim().slice(0, 200) || "公众号导入文章", html: html.slice(body.startIndex, body.endIndex + 1), images: unique };
}
async function importWechat(cloud, url, film, fetchFile = download) {
  const deadline = Date.now() + 45000;
  checkedUrl(url);
  const page = await fetchFile(url, { deadline });
  const article = parseWechat(page.buffer.toString("utf8"));
  const files = new Map(); let total = 0;
  for (let offset = 0; offset < article.images.length; offset += 3) {
    await Promise.all(article.images.slice(offset, offset + 3).map(async src => {
      const file = await fetchFile(src, { image: true, max: 10 * 1024 * 1024, deadline });
      const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };
      const extension = extensions[file.type];
      if (!extension) throw new Error("文章包含无法自动导入的图片格式，请手动上传");
      total += file.buffer.length; if (total > 40 * 1024 * 1024) throw new Error("文章图片总量过大，请分篇导入");
      const uploaded = await cloud.uploadFile({ cloudPath: `archive/${film}/articles/wechat-${crypto.randomUUID()}.${extension}`, fileContent: file.buffer });
      files.set(src, uploaded.fileID);
    }));
  }
  const urls = files.size ? await cloud.getTempFileURL({ fileList: [...files.values()] }) : { fileList: [] };
  const temporary = new Map((urls.fileList || []).map(item => [item.fileID, item.tempFileURL]));
  const withImages = sanitize(article.html, { allowedTags: [...articleFormat.tags, "section"], allowedAttributes: false, transformTags: {
    section: "div", img: (tagName, attributes) => {
      const source = attributes["data-src"] || attributes.src || "";
      const key = source.startsWith("//") ? `https:${source}` : source.replace(/^http:/, "https:");
      const id = files.get(key);
      return { tagName, attribs: { src: temporary.get(id) || "", "data-file-id": id || "", alt: attributes.alt || "", style: attributes.style || "" } };
    },
  } });
  const sourceLink = `<p><a href="${checkedUrl(url).href.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}">公众号原文</a></p>`;
  const articleHtml = sanitizeArticle(withImages + sourceLink);
  if (articleHtml.length > 500000) throw new Error("正文过长，请分篇导入");
  return { title: article.title, articleHtml, images: files.size };
}
module.exports = { checkedUrl, parseWechat, importWechat };
