"use client";
/* eslint-disable @next/next/no-img-element */
import { useState, type CSSProperties } from "react";
import { archiveSectionLabels, type ArchiveEntry, type ArchiveFilm, type ArchiveSection } from "./archive-data";
import { galleryImages, orderItems, type ArchivePresentation, type GalleryImage } from "./archive-presentation";
import ArchiveLayout from "./archive-layout";
import ArchiveLightbox from "./archive-lightbox";
import { eventHref } from "./archive-events";

export type LayoutControls = {
  disabled: boolean;
  changePoster: () => void;
  resetPoster: () => void;
  positionPoster: (axis: "posterX" | "posterY", value: number) => void;
  moveSection: (section: ArchiveSection, direction: number) => void;
  moveItem: (key: string, target: string) => void;
};

export default function ArchiveFilmView({ film, section, entries, presentation, onSectionChange, controls, message }: {
  film: ArchiveFilm; section: ArchiveSection; entries: ArchiveEntry[]; presentation: ArchivePresentation;
  onSectionChange: (section: ArchiveSection) => void; controls?: LayoutControls; message?: string;
}) {
  const [lightbox, setLightbox] = useState<{ images: GalleryImage[]; index: number } | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const isGallery = section === "photos" || section === "merch";
  const rawEntries = section === "tools" ? film.sections.tools.map((entry, index) => ({ ...entry, id: `tool:${index}` })) : entries;
  const orderedEntries = orderItems(rawEntries, presentation.itemOrders[section], entry => entry.id || "");
  const images = orderItems(galleryImages(rawEntries), presentation.itemOrders[section], item => item.key);
  const keys = isGallery ? images.map(image => image.key) : orderedEntries.map(entry => entry.id || "");
  const moveButtons = (key: string, index: number) => controls && <div className="archive-item-controls">
    <span>拖动排序</span><button type="button" disabled={controls.disabled || index === 0} aria-label={`将第 ${index + 1} 项前移`} onClick={() => controls.moveItem(key, keys[index - 1])}>←</button><button type="button" disabled={controls.disabled || index === keys.length - 1} aria-label={`将第 ${index + 1} 项后移`} onClick={() => controls.moveItem(key, keys[index + 1])}>→</button>
  </div>;
  const dragProps = (key: string) => controls ? {
    draggable: !controls.disabled,
    onDragStart: (event: React.DragEvent) => { if (controls.disabled) { event.preventDefault(); return; } event.dataTransfer.setData("text/plain", key); event.dataTransfer.effectAllowed = "move"; setDragged(key); },
    onDragOver: (event: React.DragEvent) => { if (dragged && !controls.disabled) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; } },
    onDrop: (event: React.DragEvent) => { event.preventDefault(); if (dragged && !controls.disabled) controls.moveItem(dragged, key); setDragged(null); },
    onDragEnd: () => setDragged(null),
  } : {};
  const poster = presentation.poster || film.poster;
  return <div className={`archive-page archive-film-page${controls ? " archive-layout-preview" : ""}`} style={{ "--archive-accent": film.accent, "--archive-paper": film.background, "--archive-ink": film.foreground } as CSSProperties}>
    <header className="archive-header archive-film-header">
      {controls ? <span>页面预览</span> : <a href="/archive/" className="archive-back-link">← 往期活动</a>}
      <div className="archive-header-title"><span>ISSUE {film.issue} · {film.year}</span><strong>{film.title}</strong></div>
      {!controls && <a href="/archive/admin/" className="archive-login-link">内容登录 ↗</a>}
    </header>
    <section className="archive-film-shell">
      <aside className="archive-film-identity">
        <figure><img src={poster} alt={film.posterAlt} style={{ objectPosition: `${presentation.posterX}% ${presentation.posterY}%` }} /></figure>
        <div><span>ISSUE {film.issue}</span><h1>{film.title}</h1><p>{film.zhTitle}</p>{film.date && <p><time dateTime={film.date}>{film.date}</time>{film.location ? ` · ${film.location}` : ""}</p>}</div>
        {controls && <fieldset className="archive-poster-controls" disabled={controls.disabled}><legend>活动海报</legend><div><button type="button" onClick={controls.changePoster}>更换海报</button><button type="button" onClick={controls.resetPoster}>恢复默认</button></div><label>左右位置<input type="range" min="0" max="100" value={presentation.posterX} onChange={event => controls.positionPoster("posterX", Number(event.target.value))} /></label><label>上下位置<input type="range" min="0" max="100" value={presentation.posterY} onChange={event => controls.positionPoster("posterY", Number(event.target.value))} /></label></fieldset>}
      </aside>
      <section className="archive-film-content">
        <nav className="archive-tabs" aria-label={`${film.zhTitle}内容分页`}>{presentation.sectionOrder.map((item, index) => {
          const label = archiveSectionLabels[item];
          return <div className="archive-tab-item" key={item}><a href={eventHref(film.slug, item)} className={section === item ? "is-active" : ""} aria-current={section === item ? "page" : undefined} onClick={event => { event.preventDefault(); if (!controls?.disabled) onSectionChange(item); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{label.zh}</strong><small>{label.en}</small></a>
            {controls && <div className="archive-tab-controls"><button type="button" disabled={controls.disabled || index === 0} aria-label={`${label.zh}栏目左移`} onClick={() => controls.moveSection(item, -1)}>←</button><button type="button" disabled={controls.disabled || index === 3} aria-label={`${label.zh}栏目右移`} onClick={() => controls.moveSection(item, 1)}>→</button></div>}
          </div>;
        })}</nav>
        <div className={`archive-section-page archive-section-${section}`} key={section}>
          <header><span>{String(presentation.sectionOrder.indexOf(section) + 1).padStart(2, "0")} / {archiveSectionLabels[section].en}</span><h2>{archiveSectionLabels[section].zh}</h2><p>{String(isGallery ? images.length : orderedEntries.length).padStart(2, "0")} ITEMS</p></header>
          {message ? <p className="archive-empty" role="status">{message}</p> : isGallery && images.length ? <div className="archive-photo-wall">{images.map((item, index) => <figure key={item.key} {...dragProps(item.key)} className={dragged === item.key ? "is-dragging" : ""}>
            <button type="button" className="archive-image-open" aria-label={`打开图片 ${index + 1}：${item.alt}`} onClick={() => setLightbox({ images, index })}><img src={item.image} alt={item.alt} draggable={false} loading="lazy" /></button><figcaption>{String(index + 1).padStart(2, "0")}</figcaption>{moveButtons(item.key, index)}
          </figure>)}</div> : orderedEntries.length ? <div className="archive-entry-grid">{orderedEntries.map((entry, index) => {
            const hasLayout = Boolean(entry.layout?.length || entry.articleHtml);
            const body = <>{entry.image && <figure><img src={entry.image} alt={entry.imageAlt || ""} /></figure>}<div className="archive-entry-copy"><span>{String(index + 1).padStart(2, "0")} · {entry.meta}</span><h3>{entry.title}</h3>{entry.articleHtml ? <div className="archive-rich-content" dangerouslySetInnerHTML={{ __html: entry.articleHtml }} /> : hasLayout ? <ArchiveLayout blocks={entry.layout || []} /> : entry.copy ? <p>{entry.copy}</p> : null}{!hasLayout && entry.action && <strong>{entry.action} ↗</strong>}</div></>;
            return controls ? <article className="archive-entry" key={entry.id} {...dragProps(entry.id || "")}>{moveButtons(entry.id || "", index)}{body}</article> : entry.href && !hasLayout ? <a className="archive-entry" href={entry.href} key={entry.id || index}>{body}</a> : <article className={`archive-entry${hasLayout ? " has-layout" : ""}`} key={entry.id || index}>{body}</article>;
          })}</div> : <p className="archive-empty">暂无已发布内容。</p>}
        </div>
      </section>
    </section>
    {lightbox && <ArchiveLightbox images={lightbox.images} initialIndex={lightbox.index} onClose={() => setLightbox(null)} />}
  </div>;
}
