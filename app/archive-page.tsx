"use client";

/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- shared static EdgeOne/Vite routes */

import { archiveFilms } from "./archive-data";

export default function ArchivePage() {
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
        <a href="/archive/admin/" className="archive-login-link">内容登录 ↗</a>
      </header>

      <section className="archive-poster-grid" aria-label="选择一部电影">
        {archiveFilms.map((film) => (
          <a
            key={film.slug}
            href={`/archive/${film.slug}/`}
            className="archive-poster-card"
            aria-label={`${film.issue} 期 ${film.zhTitle} ${film.title}`}
            style={{ "--card-accent": film.accent } as React.CSSProperties}
          >
            <img src={film.poster} alt={film.posterAlt} />
            <span>ISSUE {film.issue}</span>
          </a>
        ))}
      </section>

      <footer className="archive-index-footer">
        <span>{String(archiveFilms.length).padStart(2, "0")} FILMS</span>
        <span>COSMOS FILMS · 宇宙放映</span>
      </footer>
    </main>
  );
}
