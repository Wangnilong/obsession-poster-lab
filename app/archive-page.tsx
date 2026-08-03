"use client";

/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- shared static EdgeOne/Vite routes */

import { useState } from "react";

type ArchiveFilm = {
  id: "obsession" | "kill-bill";
  issue: string;
  title: string;
  zhTitle: string;
  year: string;
  status: string;
  statusTone: "archived" | "active";
  summary: string;
  cover: string;
  palette: { ink: string; accent: string; paper: string };
  tools: Array<{ label: string; copy: string; href: string }>;
  gallery: Array<{ src: string; alt: string; caption: string }>;
  merch: Array<{ src: string; alt: string; title: string; copy: string }>;
  articles: Array<{ eyebrow: string; title: string; copy: string; href?: string }>;
};

const films: ArchiveFilm[] = [
  {
    id: "obsession",
    issue: "ISSUE 01",
    title: "OBSESSION",
    zhTitle: "迷恋",
    year: "2026",
    status: "已归档",
    statusTone: "archived",
    summary: "一间把自己放进电影里的海报暗房。花挡住脸，手捧住花器，每个人都能留下自己的 Obsession。",
    cover: "/original-poster.png",
    palette: { ink: "#f3eee5", accent: "#e33b2f", paper: "#0b0909" },
    tools: [
      {
        label: "打开海报暗房",
        copy: "拍摄、构图、套用电影色调，并导出适合打印的海报。",
        href: "/obsession/",
      },
    ],
    gallery: [
      { src: "/original-poster.png", alt: "Obsession 活动主视觉", caption: "活动主视觉 / ISSUE 01" },
      { src: "/obsession-darkroom-ai.png", alt: "Obsession 海报暗房成片", caption: "海报暗房 / 参与式成片" },
    ],
    merch: [
      {
        src: "/original-poster.png",
        alt: "Obsession A3 海报",
        title: "A3 电影海报",
        copy: "保留 Obsession 标题与电影颗粒的打印版本。",
      },
      {
        src: "/obsession-title.png",
        alt: "Obsession 红色标题字样",
        title: "标题印刷实验",
        copy: "从银幕字样延伸出的贴纸与小尺寸印刷物。",
      },
    ],
    articles: [
      {
        eyebrow: "ISSUE NOTE / 01",
        title: "花为什么挡住了脸？",
        copy: "从原始海报、身体姿态和观看关系，重新进入 Obsession 的视觉逻辑。",
        href: "/issues/obsession/",
      },
    ],
  },
  {
    id: "kill-bill",
    issue: "ISSUE 02",
    title: "KILL BILL",
    zhTitle: "杀死比尔",
    year: "2026",
    status: "进行中",
    statusTone: "active",
    summary: "名单写到第五行，身份卡交到你手里。下一场放映从一张纸和一个名字开始。",
    cover: "/kill-bill/death-list-reference.jpg",
    palette: { ink: "#11100c", accent: "#a80e20", paper: "#e4c817" },
    tools: [
      {
        label: "制作暗杀名单",
        copy: "前四项划掉，第五个名字选择 BILL，或者写下你自己的名字。",
        href: "/kill-bill/#death-list",
      },
      {
        label: "制作 Killer License",
        copy: "上传照片、填写姓名与代号，生成自己的身份卡。",
        href: "/kill-bill/#id-card",
      },
    ],
    gallery: [
      { src: "/kill-bill/death-list-still.jpg", alt: "电影中的 Death List Five 画面", caption: "视觉参照 / DEATH LIST FIVE" },
      { src: "/kill-bill/death-list-reference.jpg", alt: "Death List Five 纸质名单", caption: "物料测试 / 名单与印刷" },
    ],
    merch: [
      {
        src: "/kill-bill/death-list-reference.jpg",
        alt: "Death List Five 纸质周边",
        title: "Death List Five",
        copy: "可以替换第五个名字的纸质名单。",
      },
      {
        src: "/kill-bill/death-list-still.jpg",
        alt: "Kill Bill 活动物料视觉",
        title: "Killer License",
        copy: "带个人照片与代号的身份卡；实物图将在打样后补入。",
      },
    ],
    articles: [
      {
        eyebrow: "COMING AFTER THE SCREENING",
        title: "文章将在散场后留下",
        copy: "活动记录、映后讨论与参与者作品会在这里继续更新。",
      },
    ],
  },
];

export default function ArchivePage() {
  const [selectedId, setSelectedId] = useState<ArchiveFilm["id"]>("obsession");
  const selected = films.find((film) => film.id === selectedId) ?? films[0];

  return (
    <main
      className={`archive-page archive-theme-${selected.id}`}
      style={{
        "--archive-ink": selected.palette.ink,
        "--archive-accent": selected.palette.accent,
        "--archive-paper": selected.palette.paper,
      } as React.CSSProperties}
    >
      <header className="archive-header">
        <a href="/" className="archive-logo" aria-label="返回宇宙放映首页">
          <img src="/cosmos42/logo.png" alt="宇宙放映" />
        </a>
        <nav aria-label="档案导航">
          <a href="/">首页</a>
          <a href="/kill-bill/">下一场</a>
        </nav>
      </header>

      <section className="archive-hero" aria-labelledby="archive-title">
        <p>SCREENING ARCHIVE / 放映档案</p>
        <h1 id="archive-title">电影散场以后，<br />东西还留在这里。</h1>
        <div>
          <span>{String(films.length).padStart(2, "0")} FILMS</span>
          <p>工具、映后照片、周边和文章，按每一场电影继续生长。</p>
        </div>
      </section>

      <section className="archive-picker" aria-labelledby="archive-picker-title">
        <header>
          <p>01 / CHOOSE A FILM</p>
          <h2 id="archive-picker-title">选择一部电影</h2>
        </header>
        <div className="archive-film-strip">
          {films.map((film) => (
            <button
              key={film.id}
              type="button"
              className={film.id === selected.id ? "is-selected" : ""}
              aria-pressed={film.id === selected.id}
              onClick={() => setSelectedId(film.id)}
            >
              <span className="archive-film-number">{film.issue.replace("ISSUE ", "")}</span>
              <img src={film.cover} alt="" />
              <span className="archive-film-meta">
                <small>{film.issue} · {film.year}</small>
                <strong>{film.title}</strong>
                <i>{film.zhTitle}</i>
              </span>
              <em className={`archive-status archive-status-${film.statusTone}`}>{film.status}</em>
            </button>
          ))}
        </div>
      </section>

      <section className="archive-record" key={selected.id} aria-live="polite">
        <header className="archive-record-head">
          <div>
            <p>{selected.issue} / {selected.year}</p>
            <h2>{selected.title}</h2>
          </div>
          <p>{selected.summary}</p>
        </header>

        <nav className="archive-record-index" aria-label={`${selected.title} 内容索引`}>
          <a href="#archive-tools"><span>01</span>工具</a>
          <a href="#archive-gallery"><span>02</span>映后图片</a>
          <a href="#archive-merch"><span>03</span>周边</a>
          <a href="#archive-articles"><span>04</span>文章</a>
        </nav>

        <section className="archive-block archive-tools" id="archive-tools">
          <header><p>01 / TOOLS</p><h3>把电影带走</h3></header>
          <div className="archive-tool-grid">
            {selected.tools.map((tool) => (
              <a href={tool.href} key={tool.href}>
                <span>OPEN TOOL ↗</span>
                <h4>{tool.label}</h4>
                <p>{tool.copy}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="archive-block archive-gallery" id="archive-gallery">
          <header><p>02 / AFTER THE SCREENING</p><h3>映后图片</h3></header>
          <div className="archive-gallery-grid">
            {selected.gallery.map((image, index) => (
              <figure key={image.src} className={index === 0 ? "archive-gallery-lead" : ""}>
                <img src={image.src} alt={image.alt} />
                <figcaption><span>0{index + 1}</span>{image.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="archive-block archive-merch" id="archive-merch">
          <header><p>03 / OBJECTS</p><h3>周边与物料</h3></header>
          <div className="archive-merch-grid">
            {selected.merch.map((item) => (
              <article key={item.title}>
                <figure><img src={item.src} alt={item.alt} /></figure>
                <div><h4>{item.title}</h4><p>{item.copy}</p></div>
              </article>
            ))}
          </div>
        </section>

        <section className="archive-block archive-articles" id="archive-articles">
          <header><p>04 / READING</p><h3>文章与记录</h3></header>
          <div className="archive-article-list">
            {selected.articles.map((article) => {
              const content = (
                <>
                  <span>{article.eyebrow}</span>
                  <h4>{article.title}</h4>
                  <p>{article.copy}</p>
                  <strong>{article.href ? "阅读全文 ↗" : "即将更新"}</strong>
                </>
              );
              return article.href ? <a href={article.href} key={article.title}>{content}</a> : <article key={article.title}>{content}</article>;
            })}
          </div>
        </section>
      </section>

      <footer className="archive-footer">
        <a href="/">← 返回首页</a>
        <p>SCREENING ARCHIVE · COSMOS FILMS</p>
      </footer>
    </main>
  );
}
