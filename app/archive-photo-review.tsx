"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from "react";
import type { ArchiveFilm } from "./archive-data";
import { listAudiencePhotos, reviewAudiencePhoto, type AudiencePhoto } from "./cloudbase-archive";
import ArchiveLightbox from "./archive-lightbox";
export default function ArchivePhotoReview({ films }: { films: ArchiveFilm[] }) {
  const [film, setFilm] = useState("");
  const [status, setStatus] = useState<AudiencePhoto["status"]>("pending");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<AudiencePhoto[]>([]);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<AudiencePhoto | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    listAudiencePhotos(film, status, offset).then(result => { if (active) { setItems(result.items); setMore(result.hasMore); setError(""); } }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "投稿加载失败"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [film, status, offset, reload]);
  const refresh = useCallback(() => { setLoading(true); setReload(value => value + 1); }, []);
  useEffect(() => { const navigate = (event: Event) => { if (busy) event.preventDefault(); }; window.addEventListener("cms-before-navigate", navigate); return () => window.removeEventListener("cms-before-navigate", navigate); }, [busy]);
  const review = async (item: AudiencePhoto, target: "approved" | "rejected") => {
    if (busy || loading) return;
    setBusy(true); setError(""); setMessage("");
    try { await reviewAudiencePhoto(item, target); setMessage(target === "approved" ? "照片已通过审核，已同步到活动相册。" : "照片已收起，不会在活动相册展示。"); refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "审核失败，请重试"); }
    finally { setBusy(false); }
  };
  return <section className="cms-studio cms-photo-review"><header className="cms-heading"><div><small>AUDIENCE SUBMISSIONS</small><h1>照片审核</h1></div><button type="button" disabled={loading || busy} onClick={refresh}>刷新投稿</button></header><p className="cms-layout-help">观众无需登录即可投稿。点击照片查看大图，通过审核后才会进入对应活动的映后相册。</p><div className="cms-listbar"><label>活动 <select disabled={busy} value={film} onChange={event => { setFilm(event.target.value); setOffset(0); setLoading(true); }}>{<option value="">全部活动</option>}{films.map(item => <option key={item.slug} value={item.slug}>{item.zhTitle}</option>)}</select></label><label>状态 <select disabled={busy} value={status} onChange={event => { setStatus(event.target.value as AudiencePhoto["status"]); setOffset(0); setLoading(true); }}><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已拒绝 / 已撤下</option></select></label></div>{message && <p role="status" className="cms-notice">{message}</p>}{error && <p className="cms-error" role="alert">{error}</p>}
    {loading ? <p role="status">正在加载投稿…</p> : <div className="cms-review-grid">{items.map(item => <article key={item.id}><button className="cms-review-image" type="button" onClick={() => setPreview(item)}><img src={item.image} alt={item.caption || "观众活动照片"} loading="lazy" /></button><div><strong>{films.find(film => film.slug === item.film)?.zhTitle || item.film}</strong><p>{item.caption || "未填写照片说明"}</p><small>{item.displayName} · {new Date(item.createdAt).toLocaleString("zh-CN")}</small><div className="cms-actions">{status !== "approved" && <button className="cms-primary" type="button" disabled={busy} onClick={() => void review(item, "approved")}>通过并展示</button>}{status !== "rejected" && <button type="button" disabled={busy} onClick={() => void review(item, "rejected")}>{status === "approved" ? "撤下照片" : "拒绝"}</button>}</div></div></article>)}</div>}
    {!loading && !items.length && !error && <p className="cms-empty">这里暂时没有{status === "pending" ? "待审核" : status === "approved" ? "已通过" : "已拒绝"}的照片。</p>}<div className="cms-actions"><button type="button" disabled={busy || loading || offset === 0} onClick={() => { setOffset(value => Math.max(0, value - 50)); setLoading(true); }}>上一页</button><span>第 {offset / 50 + 1} 页</span><button type="button" disabled={busy || loading || !more} onClick={() => { setOffset(value => value + 50); setLoading(true); }}>下一页</button></div>
    {preview && <ArchiveLightbox images={[{ key: preview.id, image: preview.image, alt: preview.caption || "观众活动照片" }]} initialIndex={0} onClose={() => setPreview(null)} />}
  </section>;
}
