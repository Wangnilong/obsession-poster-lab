"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import { archiveSectionLabels, type ArchiveFilm, type ArchiveSection } from "./archive-data";
import { hideEditorContent, listEditorContent, saveEditorContent, uploadArchiveImage, type ArchiveRole, type PublishedArchiveRecord } from "./cloudbase-archive";
import ArchiveRichEditor, { cleanEditorHtml } from "./archive-rich-editor";

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function legacyHtml(record: PublishedArchiveRecord) {
  if (record.articleHtml) return record.articleHtml;
  return (record.layout || []).map(block => {
    if (block.type === "image") return `<p><img src="${escape(block.image || "")}" data-file-id="${escape(block.fileID || "")}" alt="${escape(block.alt || "")}"></p>${block.caption ? `<p>${escape(block.caption)}</p>` : ""}`;
    if (block.type === "link") return `<p><a href="${escape(block.href)}">${escape(block.text)}</a></p>`;
    const tag = block.type === "heading" ? "h2" : block.type === "quote" ? "blockquote" : "p";
    return `<${tag} style="text-align:${block.align || "left"}">${escape(block.text).replace(/\n/g, "<br>")}</${tag}>`;
  }).join("") || `<p>${escape(record.copy || "")}</p>`;
}

export default function ArchiveContentStudio({ film, activeFilm, section, username, role, initialRecordId = "" }: { initialRecordId?: string; film: string; activeFilm: ArchiveFilm; section: ArchiveSection; username: string; role: ArchiveRole }) {
  const [records, setRecords] = useState<PublishedArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [current, setCurrent] = useState<PublishedArchiveRecord | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [html, setHtml] = useState("");
  const [initialHtml, setInitialHtml] = useState("");
  const [documentKey, setDocumentKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [queue, setQueue] = useState<{ id: string; file: File; url: string }[]>([]);
  const queueRef = useRef(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => () => queueRef.current.forEach(item => URL.revokeObjectURL(item.url)), []);
  const [selected, setSelected] = useState<string[]>([]);
  const isAlbum = section === "photos" || section === "merch";
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try { setRecords(await listEditorContent(film, section, role)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败，请重试"); }
    finally { setLoading(false); }
  }, [film, section, role]);
  useEffect(() => { if (section !== "tools") { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); } }, [reload, section]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || queue.length || busy || imageBusy) event.preventDefault(); };
    const navigate = (event: Event) => { if (busy || imageBusy || ((dirty || queue.length) && !window.confirm("有未保存的内容，确定离开当前页面？"))) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); window.addEventListener("cms-before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("cms-before-navigate", navigate); };
  }, [dirty, queue.length, busy, imageBusy]);

  const openArticle = useCallback((record: PublishedArchiveRecord | null) => {
    const hasPending = Boolean(record?.pendingTitle);
    setCurrent(record); setTitle(hasPending ? record!.pendingTitle! : record?.title || ""); setSummary(hasPending ? record!.pendingCopy || "" : record?.copy || "");
    const body = record ? hasPending ? record.pendingHtml || "" : legacyHtml(record) : "";
    setHtml(body); setInitialHtml(body); setDocumentKey(value => value + 1); setEditing(true); setDirty(false); setMessage("");
  }, []);
  const openedInitial = useRef(false);
  useEffect(() => {
    if (!initialRecordId || loading || error || openedInitial.current) return;
    const record = records.find(item => item._id === initialRecordId);
    const timer = setTimeout(() => { openedInitial.current = true; if (record) openArticle(record); else setMessage("这篇草稿暂时没有找到，请重新加载列表。"); }, 0);
    return () => clearTimeout(timer);
  }, [initialRecordId, loading, error, records, openArticle]);
  const saveArticle = async (publish: boolean) => {
    if (busy || imageBusy) return;
    if (!title.trim()) { setMessage("请填写文章标题"); return; }
    if (publish && !html.replace(/<[^>]*>/g, "").trim() && !html.includes("<img")) { setMessage("正文还是空的，先写点内容再发布"); return; }
    setBusy(true); setMessage(publish ? "正在发布…" : "正在保存草稿…");
    try {
      const safe = cleanEditorHtml(html);
      const record: PublishedArchiveRecord = { ...(current || {}), film, section: "articles", title: title.trim(), copy: summary, meta: `COSMOS FILMS · ${new Date().getFullYear()}`, createdAt: current?.createdAt || Date.now(), createdBy: current?.createdBy || username,
        status: publish ? "published" : "draft", articleHtml: safe, layout: [], pendingHtml: "", pendingTitle: "", pendingCopy: "" };
      if (!publish && current?.status === "published") {
        Object.assign(record, { status: "published", title: current.title, copy: current.copy, articleHtml: current.articleHtml, layout: current.layout, pendingHtml: safe, pendingTitle: title.trim(), pendingCopy: summary });
      }
      const id = await saveEditorContent(record, role);
      setCurrent({ ...record, _id: id }); setDirty(false);
      setMessage(publish ? "已发布到这场活动的图文页" : "草稿已保存到云端，可以下次继续编辑");
      await reload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "保存失败，正文仍保留在编辑器中"); }
    finally { setBusy(false); }
  };
  const saveRef = useRef(saveArticle);
  useEffect(() => { saveRef.current = saveArticle; });
  useEffect(() => {
    const hotkey = (event: KeyboardEvent) => { if (editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void saveRef.current(false); } };
    window.addEventListener("keydown", hotkey); return () => window.removeEventListener("keydown", hotkey);
  }, [editing]);
  const addFiles = (files: File[]) => {
    const images = files.filter(file => file.type.startsWith("image/") && file.size <= 20 * 1024 * 1024);
    setQueue(items => [...items, ...images.map(file => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }))]);
    setMessage(images.length === files.length ? `已选择 ${images.length} 张照片，点击上传后保存到本场相册` : `已选择 ${images.length} 张；仅支持 20 MB 以内的图片`);
  };
  const uploadPhotos = async () => {
    setBusy(true);
    let completed = 0;
    try {
      for (const item of queue) {
        setMessage(`正在上传 ${completed + 1}/${queue.length} 张…`);
        const uploaded = await uploadArchiveImage(item.file, film, section);
        await saveEditorContent({ film, section, title: item.file.name, meta: `ISSUE ${activeFilm.issue}`, fileID: uploaded.fileID, imageAlt: item.file.name, status: "published", createdAt: Date.now(), createdBy: username }, role);
        setQueue(items => items.filter(value => value.id !== item.id)); URL.revokeObjectURL(item.url); completed++;
      }
      setMessage(`${completed} 张照片已保存到本场相册`);
    } catch (cause) { setMessage(`已保存 ${completed} 张。${cause instanceof Error ? cause.message : "上传中断"}；未完成的照片保留在待上传区。`); }
    finally { await reload(); setBusy(false); }
  };
  const photos = records.filter(record => record.status !== "hidden").flatMap(record => (record.layout || []).flatMap((block, index) => block.type === "image" ? [{ key: `${record._id}:${index}`, record, block, index }] : []));
  const removePhotos = async () => {
    if (!window.confirm(`从相册移除选中的 ${selected.length} 张照片？`)) return;
    setBusy(true);
    try {
      for (const record of records) {
        const indices = photos.filter(photo => photo.record._id === record._id && selected.includes(photo.key)).map(photo => photo.index);
        if (!indices.length || !record._id) continue;
        const layout = (record.layout || []).filter((_, index) => !indices.includes(index));
        if (!layout.length) await hideEditorContent(record._id);
        else await saveEditorContent({ ...record, fileID: "", layout }, role);
      }
      setSelected([]); await reload(); setMessage("已从相册移除，原始文件仍保留在云端");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "移除失败"); }
    finally { setBusy(false); }
  };

  if (section === "tools") return <section className="cms-studio"><header className="cms-heading"><div><small>ISSUE {activeFilm.issue}</small><h1>工具</h1></div></header><div className="cms-tool-cards">{activeFilm.sections.tools.map(tool => <a key={tool.title} href={tool.href} target="_blank" rel="noreferrer"><h2>{tool.title}</h2><p>{tool.copy}</p><strong>打开生成器 ↗</strong></a>)}</div></section>;
  return <section className="cms-studio">
    <header className="cms-heading"><div><small>ISSUE {activeFilm.issue} · {activeFilm.zhTitle}</small><h1>{editing ? "编辑图文" : isAlbum ? archiveSectionLabels[section].zh : "图文内容"}</h1></div><div className="cms-actions">
      {editing ? <><button type="button" disabled={busy || imageBusy} onClick={() => { if (!dirty || window.confirm("还有未保存的修改，确定返回文章列表？")) setEditing(false); }}>← 返回列表</button><button type="button" disabled={busy || imageBusy} onClick={() => void saveArticle(false)}>保存草稿</button><button type="button" onClick={() => setPreview(true)}>预览</button><button className="cms-primary" type="button" disabled={busy || imageBusy} onClick={() => void saveArticle(true)}>{busy ? "保存中…" : "发布"}</button></> : isAlbum ? <label className="cms-primary cms-upload-label">＋ 上传照片<input type="file" accept="image/*" multiple disabled={busy} onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} /></label> : <button type="button" className="cms-primary" onClick={() => openArticle(null)}>＋ 新建图文</button>}
    </div></header>
    {message && <p className="cms-notice" role="status">{message}</p>}
    {error && <p className="cms-error" role="alert">{error} <button type="button" onClick={() => void reload()}>重新加载</button></p>}
    {editing ? <>
      <ArchiveRichEditor key={documentKey} initialHtml={initialHtml} film={film} disabled={busy} onChange={value => { setHtml(value); setDirty(true); }} onBusy={setImageBusy} onMessage={setMessage}>
        <div className="cms-document-meta"><input disabled={busy} aria-label="文章标题" placeholder="填写标题" value={title} onChange={event => { setTitle(event.target.value); setDirty(true); }} /><input disabled={busy} aria-label="文章摘要" placeholder="填写摘要（选填）" value={summary} onChange={event => { setSummary(event.target.value); setDirty(true); }} /></div>
      </ArchiveRichEditor>
      <footer className="cms-editor-status"><span>{html.replace(/<[^>]*>/g, "").length} 字</span><span>{dirty ? "有未保存的修改" : "已保存"} · Ctrl / ⌘ + S 保存草稿</span></footer>
    </> : isAlbum ? <div className="cms-album" onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }} onDrop={event => { event.preventDefault(); if (!busy) addFiles(Array.from(event.dataTransfer.files)); }}>
      <div className="cms-listbar"><strong>本场全部照片 · {photos.length} 张</strong><div><button type="button" disabled={loading} onClick={() => void reload()}>刷新</button>{role === "admin" && <><button type="button" onClick={() => setSelected(selected.length === photos.length ? [] : photos.map(photo => photo.key))}>{selected.length === photos.length && photos.length ? "取消全选" : "全选"}</button><button type="button" disabled={!selected.length || busy} onClick={() => void removePhotos()}>移除所选 {selected.length || ""}</button></>}</div></div>
      {queue.length > 0 && <section className="cms-upload-queue"><div className="cms-listbar"><strong>待上传 · {queue.length} 张</strong><button type="button" className="cms-primary" disabled={busy} onClick={() => void uploadPhotos()}>{busy ? "正在上传…" : `上传 ${queue.length} 张照片`}</button></div><div className="cms-photo-grid">{queue.map(item => <figure key={item.id}><img src={item.url} alt={item.file.name} /><figcaption>{item.file.name}<button type="button" disabled={busy} onClick={() => { setQueue(items => items.filter(value => value.id !== item.id)); URL.revokeObjectURL(item.url); }}>取消</button></figcaption></figure>)}</div></section>}
      {loading ? <p className="cms-empty">正在读取这场活动的照片…</p> : photos.length ? <div className="cms-photo-grid">{photos.map(photo => <figure key={photo.key} className={selected.includes(photo.key) ? "is-selected" : ""}>{role === "admin" && <input type="checkbox" aria-label={`选择 ${photo.block.alt || "照片"}`} checked={selected.includes(photo.key)} onChange={event => setSelected(items => event.target.checked ? [...items, photo.key] : items.filter(key => key !== photo.key))} />}<button type="button" className="cms-photo-open" onClick={() => setPreviewImage(photo.block.image || null)}><img loading="lazy" src={photo.block.image} alt={photo.block.alt || photo.record.title} /></button><figcaption><span>{photo.block.alt || photo.record.title}</span><small>{new Date(photo.record.createdAt).toLocaleDateString("zh-CN")}</small></figcaption></figure>)}</div> : !error && <p className="cms-empty">这场活动还没有上传照片。把照片拖到这里，或点击右上角「上传照片」。</p>}
    </div> : <div className="cms-article-library"><div className="cms-listbar"><nav aria-label="文章状态">{[["all", "全部"], ["draft", "草稿"], ["published", "已发布"], ["hidden", "已下架"]].map(([value, label]) => <button type="button" className={filter === value ? "is-active" : ""} key={value} onClick={() => setFilter(value)}>{label}</button>)}</nav><button type="button" onClick={() => void reload()}>刷新</button></div>
      {loading ? <p className="cms-empty">正在读取图文…</p> : records.filter(record => filter === "all" || record.status === filter).map(record => <article className="cms-article-row" key={record._id}><div><span className={`cms-badge ${record.status}`}>{record.status === "published" ? "已发布" : record.status === "hidden" ? "已下架" : "草稿"}{record.pendingHtml ? " · 有修改草稿" : ""}</span><h2>{record.pendingTitle || record.title}</h2><p>{record.copy || "暂无摘要"}</p><small>{new Date(record.updatedAt || record.createdAt).toLocaleString("zh-CN")} · {record.createdBy}</small></div><div className="cms-actions"><button type="button" onClick={() => openArticle(record)}>编辑</button>{record.status === "published" && <button type="button" disabled={busy} onClick={async () => { if (!window.confirm("将这篇文章从公开页面下架？可以稍后重新发布。")) return; setBusy(true); try { await hideEditorContent(record._id!); await reload(); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "下架失败"); } finally { setBusy(false); } }}>下架</button>}</div></article>)}
      {!loading && !records.some(record => filter === "all" || record.status === filter) && <p className="cms-empty">这里还没有图文。点击「新建图文」开始写。</p>}
    </div>}
    {(preview || previewImage) && <div className="cms-modal" role="dialog" aria-modal="true" aria-label={preview ? "文章预览" : "照片预览"} onClick={() => { setPreview(false); setPreviewImage(null); }}><button className="cms-modal-close" type="button" autoFocus onClick={() => { setPreview(false); setPreviewImage(null); }}>关闭 ×</button>{previewImage ? <img className="cms-large-photo" src={previewImage} alt="照片原图" /> : <article className="cms-phone-preview" onClick={event => event.stopPropagation()}><small>宇宙放映 · {activeFilm.zhTitle}</small><h1>{title || "文章标题"}</h1><div className="archive-rich-content" dangerouslySetInnerHTML={{ __html: cleanEditorHtml(html) }} /></article>}</div>}
  </section>;
}
