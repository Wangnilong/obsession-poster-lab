/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- static EdgeOne/Vite routes use portable anchors */
import type { CSSProperties } from "react";
import {
  currentIssue,
  editorialIssues,
  issueUrl,
} from "../src/editorial";

export default function SiteHome() {
  const issueStyle = {
    "--issue-accent": currentIssue.accent,
    "--issue-accent-dark": currentIssue.accentDark,
    "--issue-paper": currentIssue.paper,
  } as CSSProperties;

  return (
    <main className="cf42-home" style={issueStyle}>
      <header className="cf42-header">
        <a className="cf42-brand" href="/" aria-label="cosmosfilm42 宇宙观影团首页">
          <strong>cosmosfilm42</strong>
          <span>宇宙观影团</span>
        </a>
        <nav aria-label="主导航">
          <a href="#current">本期</a>
          <a href="#archive">往期</a>
          <a href="#about">关于</a>
        </nav>
        <p className="cf42-header-note">SCREENING · EDITORIAL · EXPERIENCE</p>
      </header>

      <section className="cf42-hero" id="current" aria-labelledby="current-issue-title">
        <div className="cf42-issue-number" aria-hidden="true">
          {currentIssue.number}
        </div>
        <div className="cf42-hero-copy">
          <p className="cf42-mono">
            CURRENT ISSUE / VOL.{currentIssue.number} / {currentIssue.dateLabel}
          </p>
          <h1 id="current-issue-title">
            {currentIssue.title}
            <em>{currentIssue.chineseTitle}</em>
          </h1>
          <p className="cf42-statement">{currentIssue.statement}</p>
          <p className="cf42-intro">{currentIssue.introduction}</p>
          <div className="cf42-actions">
            <a className="cf42-primary-action" href={issueUrl(currentIssue.slug)}>
              阅读本期专题
              <span>↗</span>
            </a>
            <a className="cf42-secondary-action" href={currentIssue.experienceHref}>
              打开海报暗房
            </a>
          </div>
        </div>
        <a
          className="cf42-hero-visual"
          href={issueUrl(currentIssue.slug)}
          aria-label={`阅读 ${currentIssue.title} 本期专题`}
        >
          <img
            src={currentIssue.poster}
            width={795}
            height={1194}
            alt={`${currentIssue.title} 原版电影海报`}
          />
          <span className="cf42-orbit" aria-hidden="true" />
          <div className="cf42-visual-caption">
            <span>NOW SHOWING</span>
            <strong>VOL.{currentIssue.number}</strong>
          </div>
        </a>
      </section>

      <div className="cf42-marquee" aria-hidden="true">
        <span>
          SCREENING · EDITORIAL · EXPERIENCE · SCREENING · EDITORIAL · EXPERIENCE ·
        </span>
      </div>

      <section className="cf42-edition" aria-labelledby="edition-heading">
        <header className="cf42-section-heading">
          <div>
            <p className="cf42-mono">THIS ISSUE / 目录</p>
            <h2 id="edition-heading">这一期，我们在做什么</h2>
          </div>
          <span>{currentIssue.dateLabel}</span>
        </header>

        <div className="cf42-entry-grid">
          {currentIssue.entries.map((entry, index) => {
            const content = (
              <>
                <div className="cf42-entry-top">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{entry.meta}</span>
                </div>
                <div>
                  <p>{entry.eyebrow}</p>
                  <h3>{entry.title}</h3>
                  <span className="cf42-entry-description">{entry.description}</span>
                </div>
                <span className="cf42-entry-arrow">
                  {entry.href ? "进入 ↗" : "即将开放"}
                </span>
              </>
            );
            return entry.href ? (
              <a
                className={`cf42-entry cf42-entry-${entry.kind}`}
                href={entry.href}
                key={entry.title}
              >
                {content}
              </a>
            ) : (
              <article
                className={`cf42-entry cf42-entry-${entry.kind} cf42-entry-disabled`}
                key={entry.title}
              >
                {content}
              </article>
            );
          })}
        </div>
      </section>

      <section className="cf42-archive" id="archive" aria-labelledby="archive-heading">
        <header className="cf42-section-heading">
          <div>
            <p className="cf42-mono">ALL ISSUES / ARCHIVE</p>
            <h2 id="archive-heading">每一期，都留下来</h2>
          </div>
        </header>

        <div className="cf42-archive-list">
          {editorialIssues.map((issue) => (
            <a href={issueUrl(issue.slug)} className="cf42-archive-row" key={issue.slug}>
              <span className="cf42-archive-number">{issue.number}</span>
              <span className="cf42-archive-title">
                <strong>{issue.title}</strong>
                <em>{issue.chineseTitle}</em>
              </span>
              <span>{issue.dateLabel}</span>
              <span className="cf42-archive-state">正在放映</span>
              <span>↗</span>
            </a>
          ))}
          <div className="cf42-archive-row cf42-archive-next">
            <span className="cf42-archive-number">02</span>
            <span className="cf42-archive-title">
              <strong>NEXT ISSUE</strong>
              <em>下一期</em>
            </span>
            <span>TO BE ANNOUNCED</span>
            <span className="cf42-archive-state">准备中</span>
            <span>—</span>
          </div>
        </div>
      </section>

      <section className="cf42-about" id="about">
        <p className="cf42-mono">ABOUT COSMOSFILM42</p>
        <div>
          <h2>
            不只放电影。
            <br />
            也制造电影之外的相遇。
          </h2>
          <div className="cf42-about-copy">
            <p>
              宇宙观影团是一个持续更新的电影入口：放映、写作、影像实验，以及每一期专属的互动企划。
            </p>
            <p>
              每当新电影到来，网站会换一种主题色和视觉元素；旧内容不会消失，而会继续留在档案中。
            </p>
            <a href="#current">返回本期 ↑</a>
          </div>
        </div>
      </section>

      <footer className="cf42-footer">
        <a className="cf42-brand" href="/">
          <strong>cosmosfilm42</strong>
          <span>宇宙观影团</span>
        </a>
        <p>放映 · 写作 · 互动企划</p>
        <p>© {currentIssue.year}</p>
      </footer>
    </main>
  );
}
