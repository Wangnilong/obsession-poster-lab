"use client";

/* eslint-disable @next/next/no-img-element -- shared static EdgeOne/Vite routes */

import { useEffect, useState } from "react";
import {
  archiveSectionLabels,
  findArchiveFilm,
  type ArchiveSection,
} from "./archive-data";

const sectionOrder: ArchiveSection[] = ["articles", "photos", "tools", "merch"];

function sectionFromLocation(): ArchiveSection {
  if (typeof window === "undefined") return "articles";
  const candidate = new URLSearchParams(window.location.search).get("section");
  return sectionOrder.includes(candidate as ArchiveSection) ? candidate as ArchiveSection : "articles";
}

export default function ArchiveFilmPage({ slug }: { slug: string }) {
  const film = findArchiveFilm(slug);
  const [section, setSection] = useState<ArchiveSection>("articles");

  useEffect(() => {
    const updateSection = () => setSection(sectionFromLocation());
    updateSection();
    window.addEventListener("popstate", updateSection);
    return () => window.removeEventListener("popstate", updateSection);
  }, []);

  if (!film) {
    return (
      <main className="archive-page archive-missing">
        <p>这部电影还没有进入档案。</p>
        <a href="/archive/">返回往期活动</a>
      </main>
    );
  }

  const entries = film.sections[section];

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

            {entries.length ? (
              <div className="archive-entry-grid">
                {entries.map((entry, index) => {
                  const body = (
                    <>
                      {entry.image ? <figure><img src={entry.image} alt={entry.imageAlt ?? ""} /></figure> : null}
                      <div className="archive-entry-copy">
                        <span>{String(index + 1).padStart(2, "0")} · {entry.meta}</span>
                        <h3>{entry.title}</h3>
                        {entry.copy ? <p>{entry.copy}</p> : null}
                        {entry.action ? <strong>{entry.action} ↗</strong> : null}
                      </div>
                    </>
                  );

                  return entry.href ? (
                    <a href={entry.href} className="archive-entry" key={entry.title}>{body}</a>
                  ) : (
                    <article className="archive-entry" key={entry.title}>{body}</article>
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
