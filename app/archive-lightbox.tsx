"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "./archive-presentation";

export default function ArchiveLightbox({ images, initialIndex, onClose }: { images: GalleryImage[]; initialIndex: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const touchStart = useRef<number | null>(null);
  const current = images[index];
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  const step = (direction: number) => { setIndex(value => (value + direction + images.length) % images.length); setZoomed(false); };
  return <dialog ref={dialog} className="archive-lightbox" aria-label="图片浏览" onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} onKeyDown={event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); step(event.key === "ArrowLeft" ? -1 : 1); }
  }}>
    <header><span>{index + 1} / {images.length}</span><div><button type="button" aria-pressed={zoomed} onClick={() => setZoomed(value => !value)}>{zoomed ? "适应窗口" : "放大查看"}</button><a href={current.image} target="_blank" rel="noreferrer">打开原图 ↗</a><button type="button" autoFocus onClick={onClose} aria-label="关闭图片">关闭 ×</button></div></header>
    <div className={`archive-lightbox-stage${zoomed ? " is-zoomed" : ""}`} onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => {
      if (!zoomed && touchStart.current !== null) { const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current; if (Math.abs(delta) > 60) step(delta < 0 ? 1 : -1); }
      touchStart.current = null;
    }}><img src={current.image} alt={current.alt} /></div>
    <footer><button type="button" disabled={images.length < 2} onClick={() => step(-1)} aria-label="上一张">← 上一张</button><p>{current.alt}</p><button type="button" disabled={images.length < 2} onClick={() => step(1)} aria-label="下一张">下一张 →</button></footer>
  </dialog>;
}
