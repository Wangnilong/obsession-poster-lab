"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { eventFilm, eventHref, type EventCatalog, type EventRecord } from "./archive-events";
import { getEditorEvents, saveEditorEvents, getEditorPresentation, importWechatArticle } from "./cloudbase-archive";
import { moveKey, type ArchivePresentation } from "./archive-presentation";
import { ActivityTimeline } from "./archive-timeline";
import type { ArchiveFilm, ArchiveSection } from "./archive-data";

export default function ArchiveEventsStudio({ onSaved, onOpen }: { onSaved: (films: ArchiveFilm[]) => void; onOpen: (slug: string, section?: ArchiveSection) => void }) {
  const [catalog, setCatalog] = useState<EventCatalog | null>(null);
  const [baseline, setBaseline] = useState("");
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [dragged, setDragged] = useState("");
  const [presentations, setPresentations] = useState<Record<string, ArchivePresentation>>({});
  const mounted = useRef(true);
  const dirty = Boolean(catalog && JSON.stringify(catalog) !== baseline);
  const current = catalog?.events.find(event => event.slug === selected);
  const reload = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const data = await getEditorEvents();
      if (!mounted.current) return;
      setCatalog(data); setBaseline(JSON.stringify(data)); setSelected(data.events[0]?.slug || "");
      Promise.all(data.events.map(async event => [event.slug, await getEditorPresentation(event.slug)] as const)).then(values => setPresentations(Object.fromEntries(values))).catch(() => {});
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : "加载失败"); }
    finally { if (mounted.current) setBusy(false); }
  }, []);
  useEffect(() => { mounted.current = true; const timer = setTimeout(() => void reload(), 0); return () => { clearTimeout(timer); mounted.current = false; }; }, [reload]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || busy) event.preventDefault(); };
    const navigate = (event: Event) => { if (busy || (dirty && !window.confirm("活动调整尚未保存，确定离开？"))) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); window.addEventListener("cms-before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("cms-before-navigate", navigate); };
  }, [dirty, busy]);
  const change = (patch: Partial<EventRecord>) => setCatalog(value => value && { ...value, events: value.events.map(event => event.slug === selected ? { ...event, ...patch } : event) });
  const move = (from: string, to: string) => setCatalog(value => value && { ...value, events: moveKey(value.events.map(event => event.slug), from, to).map(slug => value.events.find(event => event.slug === slug)!) });
  const save = async (publishCurrent = false) => {
    if (!catalog || busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const submitted = publishCurrent ? { ...catalog, events: catalog.events.map(event => event.slug === selected ? { ...event, status: "published" as const } : event) } : catalog;
      const data = await saveEditorEvents(submitted);
      setCatalog(data); setBaseline(JSON.stringify(data)); onSaved(data.events.map(eventFilm));
      const saved = data.events.find(event => event.slug === selected);
      setMessage(saved?.status === "published" ? `《${saved.zhTitle}》已公开，网站活动列表与日历已同步。活动内的文章仍需各自发布后才会展示。` : `《${saved?.zhTitle || "活动"}》已保存为草稿，仅后台可见。点击“保存并公开活动”后，网站才会展示。`);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setBusy(false); }
  };
  const add = () => {
    const slug = `event-${crypto.randomUUID()}`;
    setCatalog(value => value && { ...value, events: [...value.events, { slug, title: "新活动", zhTitle: "新活动", issue: String(value.events.length + 1).padStart(2, "0"), date: "", location: "", summary: "", status: "draft" }] });
    setSelected(slug); setMessage("新活动先保存为草稿，再添加海报、照片和文章。");
  };
  const importArticle = async () => {
    if (!current || busy || dirty) return;
    setBusy(true); setError(""); setMessage("正在读取公众号文章并保存图片，请稍候…");
    try { const result = await importWechatArticle(current.slug, url); setMessage(`《${result.title}》已转为文章草稿，保存了 ${result.images} 张图片。请进入“图文内容”核对后发布。`); setUrl(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "文章读取失败，可复制正文到图文编辑器"); setMessage(""); }
    finally { setBusy(false); }
  };
  return <section className="cms-studio cms-events-studio"><header className="cms-heading"><div><small>ACTIVITY DESK</small><h1>活动与日历</h1></div><div className="cms-actions"><button type="button" disabled={busy} onClick={() => { if (!dirty || window.confirm("放弃未保存的活动调整？")) void reload(); }}>重新加载</button><button type="button" disabled={busy || !catalog} onClick={add}>＋ 添加活动</button><button type="button" className="cms-primary" disabled={busy || !dirty} onClick={() => void save()}>保存活动与顺序</button></div></header>
    <p className="cms-layout-help">拖动活动卡片或点箭头调整展示位置；日历按日期标记，右侧列表跟随这里的顺序。新活动先存为草稿，内容准备好后再设为“公开”。右侧可改活动名称；“更换活动封面与裁切”会同步首页日历、往期列表和活动详情。</p>
    {message && <p className="cms-notice" role="status">{message}</p>}{error && <p className="cms-error" role="alert">{error}</p>}<p role="status">{busy ? "正在处理…" : dirty ? "有未保存的调整" : ""}</p>
    <div className="cms-event-columns"><div className="cms-event-list">{catalog?.events.map((event, index) => {
      const film = eventFilm(event);
      return <article key={event.slug} className={selected === event.slug ? "is-selected" : ""} draggable={!busy} onDragStart={e => { e.dataTransfer.setData("text/plain", event.slug); e.dataTransfer.effectAllowed = "move"; setDragged(event.slug); }} onDragOver={e => { if (dragged && !busy) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (dragged && !busy) move(dragged, event.slug); setDragged(""); }} onDragEnd={() => setDragged("")}>
        <button type="button" className="cms-event-select" disabled={busy} onClick={() => { setSelected(event.slug); setUrl(""); }}><img src={presentations[event.slug]?.poster || film.poster} alt="" /><span><strong>{event.zhTitle}</strong><small>{event.date || "日期待补充"} · {event.status === "draft" ? "草稿" : "公开"}</small></span></button><div><button type="button" disabled={busy || index === 0} aria-label={`${event.zhTitle}上移`} onClick={() => move(event.slug, catalog.events[index - 1].slug)}>↑</button><button type="button" disabled={busy || index === catalog.events.length - 1} aria-label={`${event.zhTitle}下移`} onClick={() => move(event.slug, catalog.events[index + 1].slug)}>↓</button></div>
      </article>;
    })}</div>{current && <div className="cms-event-detail"><fieldset disabled={busy}><legend>活动信息</legend><label>活动名称<input value={current.zhTitle} maxLength={100} onChange={e => change({ zhTitle: e.target.value })} /></label><label>海报大标题 / 英文名<input value={current.title} maxLength={100} onChange={e => change({ title: e.target.value })} /></label><div className="cms-event-pair"><label>期号<input value={current.issue} maxLength={20} onChange={e => change({ issue: e.target.value })} /></label><label>活动日期<input type="date" value={current.date} onChange={e => change({ date: e.target.value })} /></label></div><label>地点<input value={current.location} maxLength={200} onChange={e => change({ location: e.target.value })} /></label><label>购票跳转链接<input type="url" value={current.ticketUrl || ""} maxLength={2000} placeholder="粘贴微信小程序的购票跳转链接" onChange={e => change({ ticketUrl: e.target.value })} /></label><p>公开活动填写链接后，首页“买票”会直接跳转；多个购票活动会显示选择列表。</p><label>活动简介<textarea rows={3} maxLength={1000} value={current.summary} onChange={e => change({ summary: e.target.value })} /></label><label>可见范围<select value={current.status} onChange={e => change({ status: e.target.value as EventRecord["status"] })}><option value="draft">草稿（仅后台可见）</option><option value="published">公开</option></select></label></fieldset>
      <div className="cms-notice"><strong>{current.status === "draft" ? "草稿活动：网站上还看不到" : dirty ? "公开设置尚有未保存的调整" : "活动已公开"}</strong><p>保存活动草稿只会保留在后台。公开活动后才会出现在网站；文章草稿需要在“图文内容”里另外发布。</p><div className="cms-actions"><button type="button" className="cms-primary" disabled={busy || (current.status === "published" && !dirty)} onClick={() => void save(true)}>{current.status === "published" && !dirty ? "已公开到网站" : "保存并公开活动"}</button>{current.status === "published" && !dirty && <a className="cms-source-link" href={eventHref(current.slug)} target="_blank" rel="noopener noreferrer">查看网站活动 ↗</a>}</div></div>
      <div className="cms-actions"><button disabled={busy || dirty} type="button" onClick={() => onOpen(current.slug)}>更换活动封面与裁切</button><button disabled={busy || dirty} type="button" onClick={() => onOpen(current.slug, "photos")}>添加映后图片</button><button disabled={busy || dirty} type="button" onClick={() => onOpen(current.slug, "merch")}>添加物料图片</button><button disabled={busy || dirty} type="button" onClick={() => onOpen(current.slug, "articles")}>图文内容</button></div>{dirty && <p>先保存活动，即可管理它的图片与文章。</p>}
      <form className="cms-wechat-import" onSubmit={e => { e.preventDefault(); void importArticle(); }}><h3>公众号文章转入</h3><label>文章链接<input type="url" value={url} placeholder="https://mp.weixin.qq.com/s/…" onChange={e => setUrl(e.target.value)} required disabled={busy} /></label><button type="submit" disabled={busy || dirty || !url.trim()}>转为文章草稿</button><p>保留图文顺序并保存图片。若微信要求验证，请复制正文到图文编辑器；视频、小程序等交互内容请另行补充。</p></form>
    </div>}</div>
    {catalog && <div className="cms-calendar-preview"><h2>日历与时间线预览</h2><ActivityTimeline films={catalog.events.filter(event => event.status === "published").map(eventFilm)} presentations={presentations} /></div>}
  </section>;
}
