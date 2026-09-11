"use client";

/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- static EdgeOne/Vite routes use portable anchors */

import { useEffect, useState } from "react";
import HomeActivityTimeline from "./archive-timeline";
import SiteHomeNavigation from "./site-home-navigation";
import { defaultHomeSettings } from "./site-home-settings";
import { loadHomeSettings } from "./cloudbase-archive";

const screeningFlow = [
  ["01", "选片", "找到值得被看见的作品"],
  ["02", "解释", "研究文本与视觉，建立期待"],
  ["03", "聚集", "完成传播、报名与选座"],
  ["04", "发生", "放映、仪式、嘉宾与映后"],
  ["05", "留下", "反馈、记录、社群与复看"],
];


const collaborators = [
  ["影院 / 放映方", "万象影城、百老汇电影中心、全国艺联"],
  ["创作者 / 嘉宾", "导演、制片、演员、学者、音乐人与行业实践者"],
  ["社群 / 机构", "绿色蔷薇、BC、声色、友团与青年文化空间"],
  ["影迷 / 志愿者", "设计、摄影、文案、翻译、物料与现场支持"],
];

export default function SiteHome() {
  const [settings, setSettings] = useState(defaultHomeSettings);
  const [imageError, setImageError] = useState("");
  const slot = (key: string) => settings.slots.find(item => item.key === key)!;
  const imageProps = (key: string) => ({ src: slot(key).image, alt: slot(key).title, style: { objectPosition: slot(key).x + "% " + slot(key).y + "%" } });
  const programmeLines = settings.slots.filter(item => item.key.startsWith("programme-"));
  useEffect(() => { let active = true; loadHomeSettings().then(value => { if (active) setSettings(value); }).catch(() => { if (active) setImageError("首页图片暂时无法更新，请稍后刷新。"); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const home = document.querySelector<HTMLElement>(".intro42-home");
    const sections = document.querySelectorAll<HTMLElement>("[data-reveal]");

    if (!home || !sections.length) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sections.forEach((section) => section.classList.add("is-visible"));
      return;
    }

    home.classList.add("intro42-motion-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -12%", threshold: 0.08 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <main className="intro42-home">{imageError && <p role="status">{imageError}</p>}
      <header className="intro42-header">
        <a className="intro42-logo" href="/" aria-label="宇宙放映42 首页">
          <img {...imageProps("logo")} width={1080} height={190} alt={slot("logo").title} />
        </a>
        <SiteHomeNavigation />
        <a className="intro42-now" href="/kill-bill/">
          下一场 <span>02</span>
        </a>
      </header>

      <section className="intro42-current intro42-current-top" aria-labelledby="current-title">
        <span className="intro42-current-ghost" aria-hidden="true">02</span>
        <div className="intro42-current-copy">
          <p className="intro42-section-no">NEXT SCREENING / ISSUE 02</p>
          <h2 id="current-title">下一场：<span>{slot("current").title}</span></h2>
          <p>{slot("current").copy}</p>
          <div className="intro42-current-actions">
            <a href="/kill-bill/#death-list">制作暗杀名单 <span>↗</span></a>
            <a href="/kill-bill/#id-card">制作身份卡 <span>↗</span></a>
          </div>
        </div>
        <figure className="intro42-current-poster">
          <img {...imageProps("current")} alt={slot("current").title} />
          <figcaption><span>ISSUE 02</span><span>COMING NEXT</span></figcaption>
        </figure>
        <div className="intro42-current-ticker" aria-hidden="true">
          <span>NEXT SCREENING · {slot("current").title.toUpperCase()} · DEATH LIST FIVE · KILLER LICENSE · COSMOS FILMS ·&nbsp;</span>
          <span>NEXT SCREENING · {slot("current").title.toUpperCase()} · DEATH LIST FIVE · KILLER LICENSE · COSMOS FILMS ·&nbsp;</span>
        </div>
      </section>

      <section className="intro42-hero" aria-labelledby="intro42-title" data-reveal>
        <img className="intro42-hero-mark" {...imageProps("logo")} alt="" aria-hidden="true" />
        <span className="intro42-hero-orbit" aria-hidden="true" />
        <div className="intro42-hero-copy">
          <p className="intro42-kicker">宇宙放映42 · 我们正在做的事</p>
          <h1 id="intro42-title">
            {slot("hero").title.split("\n").map((line, index) => <span key={index} className={index ? "intro42-outline-title" : undefined}>{line}</span>)}
          </h1>
          <div className="intro42-hero-foot">
            <p>
              {slot("hero").copy}
            </p>
            <a href="#what">向下了解 <span>↓</span></a>
          </div>
        </div>
        <figure className="intro42-hero-image">
          <img
            {...imageProps("hero")}
            width={1080}
            height={1437}
            alt={slot("hero").title}
          />
          <figcaption>
            <strong>140</strong>
            <span>位观众来到第一次活动现场</span>
          </figcaption>
        </figure>
      </section>

      <section className="intro42-origin" id="what" data-reveal>
        <p className="intro42-section-no">01 / WHY WE SCREEN</p>
        <div className="intro42-origin-grid">
          <h2>起点是一次<br />想一起看电影的冲动。</h2>
          <div>
            <blockquote>“宇宙观影团本来并不存在。”</blockquote>
            <p>
              2023 年，一群四处观影的朋友从《芭比》开始：边找影院、边做设计、边研究售票，也边学习如何把一场活动真正落地。
            </p>
            <p>
              真正缺少的，从来不只是“有没有电影看”，而是让好内容稳定抵达、让组织过程可靠、让关系能够留下来的机制。
            </p>
          </div>
        </div>
      </section>

      <section className="intro42-flow" aria-labelledby="flow-title" data-reveal>
        <header className="intro42-section-head">
          <p className="intro42-section-no">02 / HOW IT HAPPENS</p>
          <h2 id="flow-title">我们把一次放映，做成五个连续动作</h2>
        </header>
        <ol>
          {screeningFlow.map(([number, title, copy]) => (
            <li key={number}>
              <span>{number}</span>
              <i aria-hidden="true" />
              <strong>{title}</strong>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
        <p className="intro42-flow-note">
          每一个动作都影响观众是否愿意来、能否安心参与，以及散场之后还愿不愿意回来。
        </p>
      </section>

      <section className="intro42-proof" data-reveal>
        <div className="intro42-proof-copy">
          <p className="intro42-section-no">03 / PRACTICE, NOT A SLOGAN</p>
          <h2>方法不是口号，<br />是被一场场活动练出来的。</h2>
          <p>
            从朋友间的一次尝试，到持续策划、跨界合作和导演映后，我们把每次活动留下的经验变成下一次的起点。
          </p>
        </div>
        <div className="intro42-metrics" aria-label="宇宙放映阶段数据">
          <article>
            <strong>2023</strong>
            <h3>第一次活动</h3>
            <p>从《芭比》宇宙派对开始</p>
          </article>
          <article>
            <strong className="blue">VOL.100</strong>
            <h3>阶段性里程碑</h3>
            <p>近期文章明确写下“第100期”</p>
          </article>
          <article>
            <strong>35 / 76</strong>
            <h3>交流成为常态</h3>
            <p>76 篇合集里，35 篇明确输出映后、主创、导演或嘉宾交流</p>
          </article>
        </div>
      </section>

      <section className="intro42-programmes" aria-labelledby="programmes-title" data-reveal>
        <header className="intro42-section-head">
          <p className="intro42-section-no">04 / THREE LINES</p>
          <h2 id="programmes-title">我们不只放一种电影，也不只做一种现场</h2>
        </header>
        <div className="intro42-programme-grid">
          {programmeLines.map((line, index) => (
            <article key={line.key}>
              <figure>
                <img className={`intro42-programme-image-${index + 1}`} {...imageProps(line.key)} alt={line.title} />
                <span>0{index + 1}</span>
              </figure>
              <h3>{line.title}</h3>
              <p>{line.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="intro42-cases" id="cases" aria-labelledby="cases-title" data-reveal>
        <header className="intro42-section-head">
          <p className="intro42-section-no">05 / TWO CASES</p>
          <h2 id="cases-title">让电影在今天重新发生</h2>
        </header>
        <div className="intro42-case-grid">
          <article className="intro42-case intro42-case-dark">
            <img {...imageProps("case-live")} alt={slot("case-live").title} />
            <div>
              <p>案例一 · 经典与现场</p>
              <h3>{slot("case-live").title}</h3>
              <p>
                {slot("case-live").copy}
              </p>
              <ul>
                <li>不把经典当作静态遗产</li>
                <li>研究文本、映前导赏与音乐演出共同构成体验</li>
                <li>连接影院、音乐人与青年文化空间</li>
              </ul>
            </div>
          </article>
          <article className="intro42-case intro42-case-light">
            <div className="intro42-case-collage">
              <img className="intro42-collage-poster" {...imageProps("case-poster")} alt={slot("case-poster").title} />
              <img className="intro42-collage-person" {...imageProps("case-person")} alt={slot("case-person").title} />
              <img className="intro42-collage-notes" {...imageProps("case-notes")} alt={slot("case-notes").title} />
            </div>
            <div>
              <p>案例二 · 电影与真实生活</p>
              <h3>{slot("case-poster").title}</h3>
              <p>
                {slot("case-poster").copy}
              </p>
              <strong>映后不是“附加环节”，它把银幕中的问题带回城市，也让观众知道自己可以如何继续参与。</strong>
            </div>
          </article>
        </div>
      </section>

      <section className="intro42-network" aria-labelledby="network-title" data-reveal>
        <div>
          <p className="intro42-section-no">06 / MADE TOGETHER</p>
          <h2 id="network-title">一场活动，<br />由很多人共同完成。</h2>
          <p>宇宙的能力不只来自内部团队，更来自长期形成的协作网络。</p>
        </div>
        <dl>
          {collaborators.map(([title, copy], index) => (
            <div key={title}>
              <dt className={index % 2 === 0 ? "pink" : "blue"}>{title}</dt>
              <dd>{copy}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="intro42-archive-entry" data-reveal>
        <div>
          <p className="intro42-section-no">07 / SCREENING ARCHIVE</p>
          <h2>散场之后，<br />电影还留在这里。</h2>
        </div>
        <div>
          <p>选择一部电影，继续打开这一期的工具、映后图片、周边和文章。</p>
          <a href="/archive/">进入往期活动 <span>↗</span></a>
        </div>
        <strong aria-hidden="true">ARCHIVE</strong>
      </section>

      <HomeActivityTimeline />

      <section className="intro42-close" data-reveal>
        <p>我们想继续做下去</p>
        <h2>一起看，各自记录；<br />让每一次相遇留下来。</h2>
        <div>
          <strong>期待与这些伙伴合作</strong>
          <p>电影创作者与发行方 · 影院与放映空间 · 文化机构与城市社群 · 独立放映组织者</p>
        </div>
      </section>

      <footer className="intro42-footer">
        <a href="/" className="intro42-logo" aria-label="宇宙放映42 首页">
          <img {...imageProps("logo")} alt={slot("logo").title} />
        </a>
        <p>cosmosfilm42 · 宇宙观影团</p>
        <p>© 2026</p>
      </footer>
    </main>
  );
}
