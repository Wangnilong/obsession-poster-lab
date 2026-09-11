// Self-contained: Chrome serializes this function into the user-selected tab.
export function readArticle() {
  if (location.protocol !== "https:" || location.hostname !== "mp.weixin.qq.com" || !/^\/s(?:\/|$)/.test(location.pathname)) {
    return { error: "请先在浏览器中打开公众号文章；如果出现微信验证，请完成后再点插件。" };
  }
  const body = document.getElementById("js_content");
  const title = document.getElementById("activity-name")?.textContent.trim();
  if (!body || !title) return { error: "还没读到文章正文。请等待文章加载，或完成页面上的微信验证后重试。" };
  const copy = body.cloneNode(true);
  copy.querySelectorAll("script,style,link,noscript,form,input,button,object,embed").forEach(node => node.remove());
  copy.querySelectorAll("iframe,video,mp-common-videosnap,mpvoice,mp-audio,mp-weapp").forEach(node => {
    const p = document.createElement("p");
    const a = document.createElement("a"); a.href = location.href;
    a.textContent = "微信视频、音频或小程序：请前往公众号原文查看";
    p.appendChild(a); node.replaceWith(p);
  });
  const images = new Set();
  for (const img of copy.querySelectorAll("img")) {
    const source = img.getAttribute("data-src") || img.getAttribute("src");
    if (!source) { img.remove(); continue; }
    let url;
    try { url = new URL(source, location.href); url.protocol = "https:"; } catch { return { error: "文章有无法读取的图片，请改用后台粘贴图文。" }; }
    if (!["mmbiz.qpic.cn", "mmbiz.qlogo.cn", "mmecoa.qpic.cn", "wx.qlogo.cn"].includes(url.hostname) || url.port || url.username || url.password) {
      return { error: "文章包含外部图片，请改用后台粘贴图文并手动上传这些图片。" };
    }
    img.setAttribute("src", url.href); img.removeAttribute("data-src"); images.add(url.href);
  }
  // Strip page behavior and lazy-loading layout; preserve basic article formatting.
  for (const node of copy.querySelectorAll("*")) {
    for (const attribute of [...node.attributes]) {
      if (!["src", "href", "alt", "title", "style", "width", "height", "colspan", "rowspan"].includes(attribute.name)) node.removeAttribute(attribute.name);
    }
    for (const property of ["visibility", "opacity", "display", "position", "overflow", "max-height"]) node.style.removeProperty(property);
    if (node.tagName === "IMG") { node.style.height = "auto"; node.style.maxWidth = "100%"; }
  }
  const html = copy.innerHTML;
  if (!copy.textContent.trim() && !images.size) return { error: "正文还是空的，请等待文章加载后再试。" };
  if (html.length > 500000 || images.size > 40) return { error: "单次支持 40 张图片、50 万字符，请在后台分篇导入。" };
  return { title: title.slice(0, 200), html, url: location.href, images: images.size };
}
