"use client";

/* eslint-disable @next/next/no-img-element -- shared static EdgeOne/Vite routes */

import { useEffect, useState } from "react";
import {
  archiveSectionLabels,
  findArchiveFilm,
  type ArchiveEntry,
  type ArchiveSection,
} from "./archive-data";
import { loadArchiveContent } from "./cloudbase-archive";
import ArchiveLayout from "./archive-layout";

const sectionOrder: ArchiveSection[] = ["articles", "photos", "tools", "merch"];

function sectionFromLocation(): ArchiveSection {
  if (typeof window === "undefined") return "articles";
  const candidate = new URLSearchParams(window.location.search).get("section");
  return sectionOrder.includes(candidate as ArchiveSection) ? candidate as ArchiveSection : "articles";
}

export default function ArchiveFilmPage({ slug }: { slug: string }) {
  const film = findArchiveFilm(slug);
  const [section, setSection] = useState<ArchiveSection>("articles");
  const [published, setPublished] = useState<{ key: string; entries: ArchiveEntry[] }>({ key: "", entries: [] });

  useEffect(() => {
    const updateSection = () => setSection(sectionFromLocation());
    updateSection();
    window.addEventListener("popstate", updateSection);
    return () => window.removeEventListener("popstate", updateSection);
  }, []);

  useEffect(() => {
    let active = true;
    const key = `${slug}:${section}`;
    loadArchiveContent(slug, section).then((entries) => {
      if (active) setPublished({ key, entries });
    });
    return () => { active = false; };
  }, [slug, section]);

  if (!film) {
    return (
      <main className="archive-page archive-missing">
        <p>这部电影还没有进入档案。</p>
        <a href="/archive/">返回往期活动</a>
      </main>
    );
  }

  const publishedEntries = section !== "tools" && published.key === `${slug}:${section}` ? published.entries : [];
  const entries = [...publishedEntries, ...film.sections[section]];
  const galleryImages = entries.flatMap((entry) => {
    const images: { image: string; alt: string }[] = [];
    if (entry.image) images.push({ image: entry.image, alt: entry.imageAlt ?? entry.title });
    entry.layout?.forEach((block) => {
      if (block.type === "image" && block.image) images.push({ image: block.image, alt: block.alt ?? entry.title });
    });
    return images;
  });

  const selectSection = (nextSection: ArchiveSection) => {
    const nextUrl = `${window.location.pathname}?section=${nextSection}`;
    window.history.pushState({}, "", nextUrl);
    setSection(nextSection);
  };

  return (
    <main
      className="archive-page archive-film-page"
      style={{
        "--archive-accent": film.accent,
        "--archive-paper": film.background,
        "--archive-ink": film.foreground,
      } as React.CSSProperties}
    >
      <header className="archive-header archive-film-header">
        <a href="/archive/" className="archive-back-link">← 往期活动</a>
        <div className="archive-header-title">
          <span>ISSUE {film.issue} · {film.year}</span>
          <strong>{film.title}</strong>
        </div>
        <a href="/archive/admin/" className="archive-login-link">内容登录 ↗</a>
      </header>

      <section className="archive-film-shell">
        <aside className="archive-film-identity">
          <figure><img src={film.poster} alt={film.posterAlt} /></figure>
          <div>
            <span>ISSUE {film.issue}</span>
            <h1>{film.title}</h1>
            <p>{film.zhTitle}</p>
          </div>
        </aside>

        <section className="archive-film-content">
          <nav className="archive-tabs" aria-label={`${film.zhTitle}内容分页`}>
            {sectionOrder.map((item) => {
              const label = archiveSectionLabels[item];
              return (
                <a
                  key={item}
                  href={`?section=${item}`}
                  className={section === item ? "is-active" : ""}
                  aria-current={section === item ? "page" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    selectSection(item);
                  }}
                >
                  <span>{label.index}</span>
                  <strong>{label.zh}</strong>
                  <small>{label.en}</small>
                </a>
              );
            })}
          </nav>

          <div className={`archive-section-page archive-section-${section}`} key={section}>
            <header>
              <span>{archiveSectionLabels[section].index} / {archiveSectionLabels[section].en}</span>
              <h2>{archiveSectionLabels[section].zh}</h2>
              <p>{String(entries.length).padStart(2, "0")} ITEMS</p>
            </header>

            {(section === "photos" || section === "merch") && galleryImages.length ? (
              <div className="archive-photo-wall">
                {galleryImages.map((item, index) => <figure key={`${item.image}-${index}`}><img src={item.image} alt={item.alt} /><figcaption>{String(index + 1).padStart(2, "0")}</figcaption></figure>)}
              </div>
            ) : entries.length ? (
              <div className="archive-entry-grid">
                {entries.map((entry, index) => {
                  const hasLayout = Boolean(entry.layout?.length);
                  const body = (
                    <>
                      {entry.image ? <figure><img src={entry.image} alt={entry.imageAlt ?? ""} /></figure> : null}
                      <div className="archive-entry-copy">
                        <span>{String(index + 1).padStart(2, "0")} · {entry.meta}</span>
                        <h3>{entry.title}</h3>
                        {hasLayout ? <ArchiveLayout blocks={entry.layout ?? []} /> : entry.copy ? <p>{entry.copy}</p> : null}
                        {!hasLayout && entry.action ? <strong>{entry.action} ↗</strong> : null}
                      </div>
                    </>
                  );

                  return entry.href && !hasLayout ? (
                    <a href={entry.href} className="archive-entry" key={`${entry.title}-${index}`}>{body}</a>
                  ) : (
                    <article className={`archive-entry${hasLayout ? " has-layout" : ""}`} key={`${entry.title}-${index}`}>{body}</article>
                  );
                })}
              </div>
            ) : (
              <p className="archive-empty">这里会在散场以后慢慢长出来。</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
