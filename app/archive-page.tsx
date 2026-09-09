"use client";

/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- shared static EdgeOne/Vite routes */

import { archiveFilms, type ArchiveFilm } from "./archive-data";
import { useEffect, useState } from "react";
import { loadArchivePresentations, loadArchiveEvents } from "./cloudbase-archive";
import { eventHref } from "./archive-events";
import { ActivityTimeline } from "./archive-timeline";
import type { ArchivePresentation } from "./archive-presentation";

export default function ArchivePage() {
  const [presentations, setPresentations] = useState<Record<string, ArchivePresentation>>({});
  const [films, setFilms] = useState<ArchiveFilm[]>(archiveFilms);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([loadArchiveEvents(), loadArchivePresentations()]).then(([events, value]) => { if (active) { setFilms(events); setPresentations(value); } }).catch(() => { if (active) setError("活动加载失败，请刷新重试。"); });
    return () => { active = false; };
  }, []);
  return (
    <main className="archive-page archive-index-page">
      <header className="archive-header">
        <a href="/" className="archive-logo" aria-label="返回宇宙放映首页">
          <img src="/cosmos42/logo.png" alt="宇宙放映" />
        </a>
        <div className="archive-header-title">
          <span>SCREENING ARCHIVE</span>
          <strong>往期活动</strong>
        </div>
        <a href="/archive/upload/" className="archive-login-link">上传活动照片 ↗</a>
      </header>

      <section className="archive-poster-grid" aria-label="选择一部电影">
        {films.map((film) => (
          <a
            key={film.slug}
            href={eventHref(film.slug)}
            className="archive-poster-card"
            aria-label={`${film.issue} 期 ${film.zhTitle} ${film.title}`}
            style={{ "--card-accent": film.accent } as React.CSSProperties}
          >
            <img src={presentations[film.slug]?.poster || film.poster} alt={film.posterAlt} style={{ objectPosition: `${presentations[film.slug]?.posterX ?? 50}% ${presentations[film.slug]?.posterY ?? 50}%` }} />
            <span>ISSUE {film.issue}</span>
            <strong className="activity-poster-title">{film.zhTitle}<small>{film.date || "日期待补充"}</small></strong>
          </a>
        ))}
      </section>
      {error && <p role="alert">{error}</p>}
      <ActivityTimeline films={films} presentations={presentations} />

      <footer className="archive-index-footer">
        <span>{String(films.length).padStart(2, "0")} EVENTS</span>
        <a href="/archive/admin/">管理后台 ↗</a><span>COSMOS FILMS · 宇宙放映</span>
      </footer>
    </main>
  );
}
