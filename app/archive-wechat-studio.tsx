"use client";

import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import DOMPurify from "dompurify";
import type { ArchiveFilm } from "./archive-data";
import { cleanEditorHtml } from "./archive-rich-editor";
import { convertWechatArticle, saveEditorContent } from "./cloudbase-archive";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function pasteHtml(html: string, text: string) {
  if (!html) return text.split(/\n/).map(line => `<p>${escape(line) || "<br>"}</p>`).join("");
  const safe = DOMPurify.sanitize(html, { ADD_TAGS: ["mp-common-videosnap", "mpvoice", "mp-audio", "mp-weapp", "iframe"], ADD_ATTR: ["data-src"], RETURN_DOM_FRAGMENT: true });
  safe.querySelectorAll("iframe,video,mp-common-videosnap,mpvoice,mp-audio,mp-weapp").forEach(embed => { const paragraph = document.createElement("p"); paragraph.textContent = "微信视频、音频或小程序：请前往公众号原文查看"; embed.replaceWith(paragraph); });
  safe.querySelectorAll("img").forEach(img => { const src = img.getAttribute("data-src") || img.getAttribute("src") || ""; img.setAttribute("src", src.startsWith("//") ? `https:${src}` : src.replace(/^http:/, "https:")); });
  safe.querySelectorAll("section").forEach(section => { const div = document.createElement("div"); Array.from(section.childNodes).forEach(node => div.appendChild(node)); section.replaceWith(div); });
  const container = document.createElement("div"); container.appendChild(safe);
  return cleanEditorHtml(container.innerHTML);
}

export default function ArchiveWechatStudio({ films, initialFilm, username, onOpen }: { films: ArchiveFilm[]; initialFilm: string; username: string; onOpen: (film: string, id: string) => void }) {
  const [film, setFilm] = useState(initialFilm);
  const [mode, setMode] = useState<"content" | "link">("content");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [converted, setConverted] = useState<{ title: string; articleHtml: string; images: number; film: string } | null>(null);
  const [savedId, setSavedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [mobilePreview, setMobilePreview] = useState(false);
  const input = useRef<HTMLDivElement>(null);
  const requestId = useRef("");
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) event.preventDefault(); };
    const navigate = (event: Event) => { if (busy || (dirty && !window.confirm("转换内容尚未保存，确定离开？"))) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); window.addEventListener("cms-before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("cms-before-navigate", navigate); };
  }, [dirty, busy]);
  const change = () => { requestId.current = ""; setConverted(null); setSavedId(""); setDirty(true); setMessage(""); setError(""); };
  const paste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const source = pasteHtml(event.clipboardData.getData("text/html"), event.clipboardData.getData("text/plain"));
    document.execCommand("insertHTML", false, source);
    setHtml(input.current?.innerHTML || source); change();
  };
  const convert = async () => {
    if (busy) return;
    requestId.current ||= crypto.randomUUID();
    setBusy(true); setError(""); setMessage("正在整理排版、保存图片和草稿…");
    try {
      const result = await convertWechatArticle({ film, mode, title, url, html, requestId: requestId.current, saveDraft: true });
      setConverted({ ...result, articleHtml: cleanEditorHtml(result.articleHtml), film }); setSavedId(result.id); setDirty(false);
      setMessage(`转换完成，${result.images} 张图片和文章草稿已自动保存。可以直接进入编辑器调整和发布。`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "转换失败，请重试"); setMessage(""); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!converted) return;
    setBusy(true); setError("");
    try {
      const id = await saveEditorContent({ ...(savedId ? { _id: savedId } : {}), film: converted.film, section: "articles", title: converted.title, meta: "公众号转入", articleHtml: converted.articleHtml, status: "draft", createdAt: Date.now(), createdBy: username }, "admin");
      setSavedId(id); setDirty(false); setMessage("已保存到活动的图文草稿，可进入编辑器继续调整和发布。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，转换结果仍保留"); }
    finally { setBusy(false); }
  };
  const download = async () => {
    if (!converted) return;
    setBusy(true); setError(""); setMessage("正在把图片打包进网页…");
    try {
      const container = document.createElement("div"); container.innerHTML = converted.articleHtml;
      const images = Array.from(container.querySelectorAll("img"));
      const cached = new Map<string, string>();
      for (const img of images) {
        const src = img.src;
        if (!cached.has(src)) {
          const response = await fetch(src, { credentials: "omit", signal: AbortSignal.timeout(20000) });
          if (!response.ok) throw new Error("图片暂时无法下载，请重试；已保存的草稿不受影响");
          const blob = await response.blob();
          if (!blob.type.startsWith("image/") || blob.size > 10 * 1024 * 1024) throw new Error("图片无法打包，请从活动草稿查看");
          const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("图片读取失败")); reader.readAsDataURL(blob); });
          cached.set(src, data);
        }
        img.src = cached.get(src)!; img.removeAttribute("data-file-id");
      }
      const documentHtml = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(converted.title)}</title><style>body{max-width:760px;margin:40px auto;padding:24px;font-family:system-ui,sans-serif;line-height:1.9;color:#222}img{max-width:100%;height:auto}h1{line-height:1.4}table{max-width:100%}</style><h1>${escape(converted.title)}</h1>${container.innerHTML}</html>`;
      const objectUrl = URL.createObjectURL(new Blob([documentHtml], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a"); link.href = objectUrl; link.download = `${converted.title.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage("网页已下载，文字与图片可离线查看。保存到活动草稿后还可继续编辑。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "下载失败，转换结果仍保留"); }
    finally { setBusy(false); }
  };
  return <section className="cms-studio cms-converter"><header className="cms-heading"><div><small>ARTICLE CONVERTER</small><h1>公众号转网页</h1></div></header>
    <p>复制公众号文章的图文，粘贴到左侧。转换后自动保存为活动草稿，再预览、编辑或下载网页。</p>
    <fieldset disabled={busy}><legend>文章来源</legend><div className="cms-actions"><button type="button" aria-pressed={mode === "content"} onClick={() => { setMode("content"); change(); }}>粘贴图文</button><button type="button" aria-pressed={mode === "link"} onClick={() => { setMode("link"); change(); }}>输入公众号链接</button></div>
      <div className="cms-event-pair"><label>所属活动<select value={film} onChange={event => { setFilm(event.target.value); change(); }}>{films.map(item => <option key={item.slug} value={item.slug}>{item.zhTitle}</option>)}</select></label><label>文章标题{mode === "link" && "（自动读取）"}<input value={title} disabled={mode === "link"} maxLength={200} onChange={event => { setTitle(event.target.value); change(); }} /></label></div>
      <label>公众号原文链接{mode === "content" && "（选填）"}<input type="url" value={url} placeholder="https://mp.weixin.qq.com/s/…" onChange={event => { setUrl(event.target.value); change(); }} /></label>
    </fieldset>
    <div className="cms-converter-columns"><section><h2>{mode === "content" ? "粘贴公众号图文" : "链接导入"}</h2><div hidden={mode !== "content"}><div ref={input} className="cms-paste-surface" role="textbox" aria-label="公众号图文内容" aria-multiline="true" contentEditable={!busy} suppressContentEditableWarning onPaste={paste} onDrop={event => event.preventDefault()} onInput={() => { setHtml(input.current?.innerHTML || ""); change(); }} /></div>{mode === "link" && <p>输入原文链接后点击转换。如果微信要求验证，可切换到“粘贴图文”，复制正文继续处理。</p>}<button type="button" className="cms-primary" disabled={busy || !films.some(item => item.slug === film) || (mode === "content" ? !title.trim() || !html.trim() : !url.trim())} onClick={() => void convert()}>{busy ? "处理中…" : "转换并保存草稿 →"}</button><p className="cms-converter-help">支持文字、图片和基本排版。微信视频、小程序、抽奖及留言请在原文中使用；复制时请带上所需图片。</p></section>
      <section><div className="cms-preview-heading"><h2>网页预览</h2><button type="button" aria-pressed={mobilePreview} onClick={() => setMobilePreview(value => !value)}>{mobilePreview ? "切回宽屏" : "查看手机宽度"}</button></div>{converted ? <><article className={`cms-converted-page${mobilePreview ? " is-mobile-preview" : ""}`}><h1>{converted.title}</h1><div className="archive-article-rich" dangerouslySetInnerHTML={{ __html: converted.articleHtml }} /></article><div className="cms-actions"><button type="button" className="cms-primary" disabled={busy || Boolean(savedId)} onClick={() => void save()}>{savedId ? "已保存草稿" : "保存到活动草稿"}</button><button type="button" disabled={busy} onClick={() => void download()}>下载网页</button>{savedId && <button type="button" disabled={busy} onClick={() => onOpen(converted.film, savedId)}>进入图文编辑器</button>}</div><p>下载会将图片一起打包；活动草稿可继续编辑和发布。</p></> : <div className="cms-converter-empty">转换后在这里核对网页效果</div>}</section></div>
    {message && <p className="cms-notice" role="status">{message}</p>}{error && <p className="cms-error" role="alert">{error}</p>}
  </section>;
}
