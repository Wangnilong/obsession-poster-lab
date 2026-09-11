"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { type ArchiveFilm, type ArchiveEntry, type ArchiveSection } from "./archive-data";
import { getEditorPresentation, loadEditorDocument, saveEditorPresentation, uploadArchiveImage } from "./cloudbase-archive";
import { eventHref } from "./archive-events";
import { defaultSectionOrder, galleryImages, moveKey, orderItems, type ArchivePresentation } from "./archive-presentation";
import ArchiveFilmView from "./archive-film-view";

export default function ArchiveLayoutStudio({ film, activeFilm }: { film: string; activeFilm: ArchiveFilm }) {
  const [layout, setLayout] = useState<ArchivePresentation | null>(null);
  const [entries, setEntries] = useState<Record<ArchiveSection, ArchiveEntry[]>>({ articles: [], photos: [], merch: [], tools: [] });
  const [section, setSection] = useState<ArchiveSection>("photos");
  const [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const picker = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const dirty = layout !== null && JSON.stringify(layout) !== baseline;
  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [config, ...documents] = await Promise.all([getEditorPresentation(film), ...defaultSectionOrder.map(section => loadEditorDocument(film, section))]);
      if (!mounted.current) return;
      const content = Object.fromEntries(defaultSectionOrder.map((section, index) => [section, documents[index].entries])) as Record<ArchiveSection, ArchiveEntry[]>;
      const orders = { ...config.itemOrders };
      for (const section of defaultSectionOrder) {
        const keys = section === "tools" ? activeFilm.sections.tools.map((_, index) => `tool:${index}`) : section === "articles" ? content.articles.map(entry => entry.id!) : galleryImages(content[section]).map(item => item.key);
        orders[section] = orderItems(keys, orders[section], key => key);
      }
      const next = { ...config, itemOrders: orders };
      setEntries(content); setLayout(next); setBaseline(JSON.stringify(next)); setMessage("");
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "页面加载失败"); }
    finally { if (mounted.current) setLoading(false); }
  }, [film, activeFilm]);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void reload(), 0);
    return () => { window.clearTimeout(timer); mounted.current = false; };
  }, [reload]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) event.preventDefault(); };
    const navigate = (event: Event) => { if (busy || (dirty && !window.confirm("页面布局还没有保存，确定离开？"))) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); window.addEventListener("cms-before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("cms-before-navigate", navigate); };
  }, [dirty, busy]);
  const upload = async (file: File) => {
    if (busy) return;
    setBusy(true); setError(""); setMessage("正在上传海报…");
    try {
      const image = await uploadArchiveImage(file, film, "covers");
      setLayout(value => value && { ...value, posterFileID: image.fileID, poster: image.url, posterX: 50, posterY: 50 });
      setMessage("海报已放入预览，可调整裁切位置后保存。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "海报上传失败"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!layout || busy || loading) return;
    setBusy(true); setError(""); setMessage("正在保存页面布局…");
    try {
      const saved = await saveEditorPresentation(film, layout);
      setLayout(saved); setBaseline(JSON.stringify(saved)); setMessage("页面布局已保存，公开页面已同步。");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，调整仍保留在预览中"); setMessage(""); }
    finally { setBusy(false); }
  };
  return <section className="cms-studio cms-layout-studio">
    <header className="cms-heading"><div><small>ISSUE {activeFilm.issue} · {activeFilm.zhTitle}</small><h1>页面布局</h1></div><div className="cms-actions"><a href={eventHref(film, section)} target="_blank" rel="noreferrer">打开公开页面 ↗</a><button type="button" disabled={busy || loading} onClick={() => { if (!dirty || window.confirm("放弃未保存的调整，重新加载线上布局？")) void reload(); }}>重新加载</button><button type="button" className="cms-primary" disabled={busy || loading || !layout || !dirty} onClick={() => void save()}>{busy ? "处理中…" : "保存页面布局"}</button></div></header>
    <p className="cms-layout-help">直接在下方预览中更换海报、移动栏目和内容。图片可拖动排序，也可用 ← → 调整。保存后对外生效。</p>
    <p className="cms-layout-status" role="status">{loading ? "正在加载页面…" : dirty ? "有未保存的布局调整" : "与线上布局一致"}</p>
    {message && <p className="cms-notice" role="status">{message}</p>}{error && <p className="cms-error" role="alert">{error}{!layout && <button type="button" onClick={() => void reload()}>重试</button>}</p>}
    <input type="file" accept="image/*" hidden ref={picker} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
    {layout && <div className="cms-layout-canvas"><ArchiveFilmView film={activeFilm} section={section} entries={entries[section]} presentation={layout} onSectionChange={setSection} controls={{
      disabled: busy || loading,
      changePoster: () => picker.current?.click(),
      resetPoster: () => setLayout(value => value && { ...value, posterFileID: "", poster: "", posterX: 50, posterY: 50 }),
      positionPoster: (axis, position) => setLayout(value => value && { ...value, [axis]: position }),
      moveSection: (key, direction) => setLayout(value => {
        if (!value) return value;
        const index = value.sectionOrder.indexOf(key), target = value.sectionOrder[index + direction];
        return target ? { ...value, sectionOrder: moveKey(value.sectionOrder, key, target) as ArchiveSection[] } : value;
      }),
      moveItem: (key, target) => setLayout(value => value && { ...value, itemOrders: { ...value.itemOrders, [section]: moveKey(value.itemOrders[section], key, target) } }),
    }} /></div>}
  </section>;
}
