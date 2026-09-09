"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { loadArchiveEvents, submitAudiencePhoto } from "./cloudbase-archive";
import type { ArchiveFilm } from "./archive-data";
import { eventHref } from "./archive-events";

type QueuedPhoto = { id: string; token: string; file: File; url: string; status: "ready" | "sending" | "sent" | "failed"; error?: string };
async function preparePhoto(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const picture = new Image();
    picture.src = url; await picture.decode();
    if (!picture.naturalWidth || !picture.naturalHeight) throw new Error("无法读取图片");
    const canvas = document.createElement("canvas"), context = canvas.getContext("2d");
    if (!context) throw new Error("浏览器无法处理照片");
    for (let size = Math.min(2200, Math.max(picture.naturalWidth, picture.naturalHeight)); size >= 300; size = Math.floor(size * .8)) {
      const scale = Math.min(1, size / Math.max(picture.naturalWidth, picture.naturalHeight));
      canvas.width = Math.max(1, Math.round(picture.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(picture.naturalHeight * scale));
      context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(picture, 0, 0, canvas.width, canvas.height);
      for (const quality of [.86, .76, .65]) { const data = canvas.toDataURL("image/jpeg", quality); if (data.length < 1050000) return data; }
    }
    // Small originals also pass through the canvas to remove embedded metadata.
    canvas.width = Math.max(1, Math.min(300, picture.naturalWidth)); canvas.height = Math.max(1, Math.round(picture.naturalHeight * canvas.width / picture.naturalWidth));
    if (canvas.height > 2200) { canvas.width = Math.max(1, Math.round(canvas.width * 2200 / canvas.height)); canvas.height = 2200; }
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", .7); if (data.length < 1050000) return data;
    throw new Error("照片过大，请换一张图片");
  } finally { URL.revokeObjectURL(url); }
}

export default function ArchiveUploadPage() {
  const [films, setFilms] = useState<ArchiveFilm[]>([]);
  const [film, setFilm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [caption, setCaption] = useState("");
  const [consent, setConsent] = useState(false);
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const queueRef = useRef(queue);
  const locked = busy || queue.some(item => item.status !== "ready");
  const sent = queue.filter(item => item.status === "sent").length;
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => () => queueRef.current.forEach(item => URL.revokeObjectURL(item.url)), []);
  useEffect(() => {
    let active = true;
    loadArchiveEvents().then(events => { if (active) { setFilms(events); const requested = new URLSearchParams(window.location.search).get("event"); setFilm(events.some(event => event.slug === requested) ? requested! : ""); setError(""); } }).catch(() => { if (active) setError("活动加载失败，请重试。"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (busy || queue.some(item => item.status !== "sent")) event.preventDefault(); }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [busy, queue]);
  const addFiles = (files: File[]) => {
    if (locked) return;
    setError("");
    const accepted: QueuedPhoto[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > 20 * 1024 * 1024) { setError("请选择不超过 20 MB 的图片文件。"); continue; }
      if (queue.length + accepted.length >= 10) { setError("每批最多选择 10 张照片。"); break; }
      accepted.push({ id: crypto.randomUUID(), token: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: "ready" });
    }
    setQueue(value => [...value, ...accepted]);
  };
  const upload = async () => {
    if (!film || !consent || busy || !queue.length) return;
    setBusy(true); setError("");
    const update = (id: string, patch: Partial<QueuedPhoto>) => setQueue(value => value.map(item => item.id === id ? { ...item, ...patch } : item));
    for (const item of queue.filter(item => item.status !== "sent")) {
      update(item.id, { status: "sending", error: "" });
      try { const imageData = await preparePhoto(item.file); await submitAudiencePhoto({ film, submissionId: item.id, uploadToken: item.token, imageData, displayName, caption, consent }); update(item.id, { status: "sent" }); }
      catch (cause) { update(item.id, { status: "failed", error: cause instanceof Error ? cause.message : "网络不稳定，请重试" }); }
    }
    setBusy(false);
  };
  return <main className="archive-page audience-upload-page"><header className="archive-header"><a href="/archive/" className="archive-back-link">← 往期活动</a><div className="archive-header-title"><span>SHARE THE SCREENING</span><strong>上传活动照片</strong></div><a href="/archive/admin/" className="archive-login-link">管理后台 ↗</a></header><div className="audience-upload-desk"><header><span>YOUR VIEW OF THE DAY</span><h1>把你眼中的<br />这一场留下来。</h1><p>无需登录。照片提交后由管理员审核，通过后会出现在活动的映后图片中。</p></header>
    {error && <p className="audience-error" role="alert">{error}{!films.length && <button type="button" onClick={() => { setLoading(true); setReload(value => value + 1); }}>重试</button>}</p>}
    <form onSubmit={event => { event.preventDefault(); void upload(); }}><fieldset disabled={locked || loading}><label>选择活动<select required value={film} onChange={event => setFilm(event.target.value)}><option value="">{loading ? "正在加载活动…" : "请选择照片对应的活动"}</option>{films.map(item => <option key={item.slug} value={item.slug}>{item.zhTitle}{item.date ? ` · ${item.date}` : ""}</option>)}</select></label><div className="audience-fields"><label>署名（选填）<input value={displayName} maxLength={40} placeholder="留空将显示为匿名观众" onChange={event => setDisplayName(event.target.value)} /></label><label>照片说明（选填）<input value={caption} maxLength={300} placeholder="记录这一刻" onChange={event => setCaption(event.target.value)} /></label></div></fieldset>
    <label className={`audience-dropzone${locked ? " is-disabled" : ""}`} onDragOver={event => { if (!locked) event.preventDefault(); }} onDrop={event => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}><strong>＋ 选择照片</strong><span>支持多选或拖入图片，每批最多 10 张</span><input type="file" accept="image/*" multiple disabled={locked || loading} onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = ""; }} /></label>
    <div className="audience-photo-queue">{queue.map(item => <article key={item.id}><img src={item.url} alt={item.file.name} /><div><strong>{item.file.name}</strong><p role="status">{item.status === "sent" ? "已提交，等待审核" : item.status === "sending" ? "正在提交…" : item.status === "failed" ? item.error : "待提交"}</p>{item.status === "ready" && !locked && <button type="button" onClick={() => { URL.revokeObjectURL(item.url); setQueue(value => value.filter(photo => photo.id !== item.id)); }}>移除</button>}</div></article>)}</div>
    <label className="audience-consent"><input type="checkbox" checked={consent} disabled={locked} onChange={event => setConsent(event.target.checked)} /><span>我确认有权提交这些照片，并同意审核通过后在活动页面公开展示。</span></label>
    <div className="audience-submit"><button type="submit" disabled={busy || !film || !consent || !queue.length || sent === queue.length}>{busy ? `正在提交 ${sent} / ${queue.length}` : queue.some(item => item.status === "failed") ? "重试未成功的照片" : "提交照片，等待审核"}</button>{locked && !busy && <button type="button" className="audience-secondary" onClick={() => { if (queue.some(item => item.status === "failed") && !window.confirm("清除未成功的照片，重新选择？")) return; queue.forEach(item => URL.revokeObjectURL(item.url)); setQueue([]); }}>重新选择照片</button>}</div>
    {sent > 0 && <p className="audience-success" role="status">已收到 {sent} 张照片，审核通过后才会展示。{film && <a href={eventHref(film, "photos")}>返回活动相册 ↗</a>}</p>}
    </form></div></main>;
}
