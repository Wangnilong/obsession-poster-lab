"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import { getEditorHomeSettings, saveHomeSettings, uploadArchiveImage } from "./cloudbase-archive";
import { defaultHomeSettings, type HomeSettings, type HomeSlot } from "./site-home-settings";

export default function SiteHomeStudio() {
  const [settings, setSettings] = useState<HomeSettings | null>(null);
  const [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = Boolean(settings && JSON.stringify(settings) !== baseline);
  const reload = useCallback(async () => {
    setBusy(true); setError("");
    try { const next = await getEditorHomeSettings(); setSettings(next); setBaseline(JSON.stringify(next)); setMessage(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败，请重试"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (busy || dirty) event.preventDefault(); };
    const navigate = (event: Event) => { if (busy || (dirty && !window.confirm("首页调整尚未保存，确定离开？"))) event.preventDefault(); };
    window.addEventListener("beforeunload", warn); window.addEventListener("cms-before-navigate", navigate);
    return () => { window.removeEventListener("beforeunload", warn); window.removeEventListener("cms-before-navigate", navigate); };
  }, [busy, dirty]);
  const change = (key: string, patch: Partial<HomeSlot>) => { setSettings(value => value && { ...value, slots: value.slots.map(slot => slot.key === key ? { ...slot, ...patch } : slot) }); setMessage(""); };
  const upload = async (key: string, file: File) => {
    setBusy(true); setError("");
    try { const result = await uploadArchiveImage(file, "home", "covers"); change(key, { fileID: result.fileID, image: result.url, x: 50, y: 50 }); setMessage("图片已放入预览，保存首页后对外生效。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "上传失败"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!settings || busy) return;
    setBusy(true); setError("");
    try { const next = await saveHomeSettings(settings); setSettings(next); setBaseline(JSON.stringify(next)); setMessage("首页图片与文字已保存，正式网站已同步。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败，调整仍保留"); }
    finally { setBusy(false); }
  };
  return <section className="cms-studio"><header className="cms-heading"><div><small>HOME EDITOR</small><h1>首页图片与文字</h1></div><div className="cms-actions"><a href="/" target="_blank" rel="noopener noreferrer">查看首页 ↗</a><button disabled={busy} onClick={() => { if (!dirty || window.confirm("放弃未保存的首页调整？")) void reload(); }}>重新加载</button><button className="cms-primary" disabled={busy || !dirty} onClick={() => void save()}>保存首页并同步</button></div></header><p>下方按首页出现顺序展示。可更换图片、修改对应标题和说明，拖动滑杆调整裁切。活动名称与封面请到“活动与日历”修改。</p><p role="status">{busy ? "正在处理…" : dirty ? "有未保存的首页调整" : ""}</p>{message && <p className="cms-notice" role="status">{message}</p>}{error && <p className="cms-error" role="alert">{error}</p>}<div className="cms-home-grid">{settings?.slots.map(slot => <fieldset className="cms-home-card" disabled={busy} key={slot.key}><legend>{slot.label}</legend><img src={slot.image} alt={slot.title} style={{ objectPosition: `${slot.x}% ${slot.y}%` }} /><label>更换图片<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(slot.key, file); }} /></label><label>标题 / 图片名称<textarea rows={2} maxLength={200} value={slot.title} onChange={event => change(slot.key, { title: event.target.value })} /></label>{defaultHomeSettings().slots.find(item => item.key === slot.key)?.copy && <label>说明<textarea rows={3} maxLength={2000} value={slot.copy} onChange={event => change(slot.key, { copy: event.target.value })} /></label>}<div className="cms-event-pair"><label>左右位置 {slot.x}%<input type="range" min="0" max="100" value={slot.x} onChange={event => change(slot.key, { x: Number(event.target.value) })} /></label><label>上下位置 {slot.y}%<input type="range" min="0" max="100" value={slot.y} onChange={event => change(slot.key, { y: Number(event.target.value) })} /></label></div><button type="button" onClick={() => { const original = defaultHomeSettings().slots.find(item => item.key === slot.key)!; change(slot.key, { image: original.image, fileID: "", x: 50, y: 50 }); }}>恢复原图片</button></fieldset>)}</div></section>;
}
