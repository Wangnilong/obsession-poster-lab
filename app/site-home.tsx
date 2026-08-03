"use client";

/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- static EdgeOne/Vite routes use portable anchors */

import { useEffect } from "react";

const screeningFlow = [
  ["01", "选片", "找到值得被看见的作品"],
  ["02", "解释", "研究文本与视觉，建立期待"],
  ["03", "聚集", "完成传播、报名与选座"],
  ["04", "发生", "放映、仪式、嘉宾与映后"],
  ["05", "留下", "反馈、记录、社群与复看"],
];

const programmeLines = [
  {
    title: "流行文化共创",
    copy: "从《芭比》派对到哈利·波特系列观影礼，让熟悉的电影成为共同节日。",
    image: "/cosmos42/barbie-wall.jpg",
    alt: "《芭比》放映现场观众合影墙",
  },
  {
    title: "经典与艺术实验",
    copy: "默片现场配乐、女性影像、身体性展映和短片巡游，让放映形式本身成为创作。",
    image: "/cosmos42/train.jpg",
    alt: "《火车进站》影片画面",
  },
  {
    title: "现实议题与本地故事",
    copy: "社工实践、女性叙事、独立纪录片与深圳题材，让电影和真实生活重新接通。",
    image: "/cosmos42/broad-daylight.jpg",
    alt: "电影《白日之下》海报",
  },
];

const collaborators = [
  ["影院 / 放映方", "万象影城、百老汇电影中心、全国艺联"],
  ["创作者 / 嘉宾", "导演、制片、演员、学者、音乐人与行业实践者"],
  ["社群 / 机构", "绿色蔷薇、BC、声色、友团与青年文化空间"],
  ["影迷 / 志愿者", "设计、摄影、文案、翻译、物料与现场支持"],
];

export default function SiteHome() {
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
    <main className="intro42-home">
      <header className="intro42-header">
        <a className="intro42-logo" href="/" aria-label="宇宙放映42 首页">
          <img src="/cosmos42/logo.png" width={1080} height={190} alt="宇宙放映" />
          <span>42</span>
        </a>
        <nav aria-label="主页导航">
          <a href="#what">我们做什么</a>
          <a href="#cases">活动案例</a>
          <a href="#yingji">映集</a>
        </nav>
        <a className="intro42-now" href="/issues/obsession/">
          正在放映 <span>01</span>
        </a>
      </header>

      <section className="intro42-current intro42-current-top" aria-labelledby="current-title">
        <span className="intro42-current-ghost" aria-hidden="true">01</span>
        <div className="intro42-current-copy">
          <p className="intro42-section-no">NOW SCREENING / ISSUE 01</p>
          <h2 id="current-title">当前放映：<span>Obsession</span></h2>
          <p>本期包含电影专题，以及一间可以把自己放进电影里的海报暗房。</p>
          <div className="intro42-current-actions">
            <a href="/issues/obsession/">阅读本期专题 <span>↗</span></a>
            <a href="/obsession/">打开海报暗房 <span>↗</span></a>
          </div>
        </div>
        <figure className="intro42-current-poster">
          <img src="/original-poster.png" alt="Obsession 原版电影海报" />
          <figcaption><span>ISSUE 01</span><span>ACTIVE</span></figcaption>
        </figure>
        <div className="intro42-current-ticker" aria-hidden="true">
          <span>NOW SCREENING · OBSESSION · COSMOS FILMS 42 · NOW SCREENING · OBSESSION · COSMOS FILMS 42 ·&nbsp;</span>
          <span>NOW SCREENING · OBSESSION · COSMOS FILMS 42 · NOW SCREENING · OBSESSION · COSMOS FILMS 42 ·&nbsp;</span>
        </div>
      </section>

      <section className="intro42-hero" aria-labelledby="intro42-title" data-reveal>
        <img className="intro42-hero-mark" src="/cosmos42/logo.png" alt="" aria-hidden="true" />
        <span className="intro42-hero-orbit" aria-hidden="true" />
        <div className="intro42-hero-copy">
          <p className="intro42-kicker">宇宙放映42 · 我们正在做的事</p>
          <h1 id="intro42-title">
            <span>把值得的电影</span>
            <span className="intro42-outline-title">带到愿意相遇的人面前</span>
          </h1>
          <div className="intro42-hero-foot">
            <p>
              我们做的，不是把人带进影院就结束，
              <br />
              而是让一次共同观看有来路、有现场，也有余韵。
            </p>
            <a href="#what">向下了解 <span>↓</span></a>
          </div>
        </div>
        <figure className="intro42-hero-image">
          <img
            src="/cosmos42/barbie-opening.jpg"
            width={1080}
            height={1437}
            alt="宇宙放映第一次活动的观众现场"
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
          <h2>起点不是一家公司，<br />而是一次想一起看电影的冲动。</h2>
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
            <article key={line.title}>
              <figure>
                <img className={`intro42-programme-image-${index + 1}`} src={line.image} alt={line.alt} />
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
            <img src="/cosmos42/goddess-live.jpg" alt="《神女》默片现场配乐演出" />
            <div>
              <p>案例一 · 经典与现场</p>
              <h3>《神女》× 默片即兴配乐</h3>
              <p>
                把百年前的影像带回影院，邀请音乐家以结构化即兴进行现场配乐；银幕、演奏者与观众共同组成一次不可复制的三角对话。
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
              <img className="intro42-collage-poster" src="/cosmos42/broad-daylight.jpg" alt="《白日之下》电影海报" />
              <img className="intro42-collage-person" src="/cosmos42/social-work.jpg" alt="《白日之下》映后社工实践分享" />
              <img className="intro42-collage-notes" src="/cosmos42/broad-daylight-notes.jpg" alt="《白日之下》映后记录物料" />
            </div>
            <div>
              <p>案例二 · 电影与真实生活</p>
              <h3>《白日之下》× 社工实践映后</h3>
              <p>
                电影揭示弱势群体处境，映后邀请一线社工从实践角度继续讨论；活动结余用于支持相关社工与公益工作。
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

      <section className="intro42-yingji" id="yingji" aria-labelledby="yingji-title" data-reveal>
        <div className="intro42-yingji-copy">
          <p className="intro42-section-no">07 / WHAT COMES NEXT</p>
          <h2 id="yingji-title">把实践沉淀成「映集」</h2>
          <p>
            一套从真实放映现场长出来的轻量组织与记录工具：从发布、选座和核销，到映后卡、评分、反馈与可信记录。
          </p>
          <ul>
            <li><span>01</span>影院感，不做泛活动平台</li>
            <li><span>02</span>信息清楚，降低赴约成本</li>
            <li><span>03</span>散场之后，记录才开始</li>
          </ul>
        </div>
        <figure>
          <img src="/cosmos42/yingji.png" alt="映集移动端产品界面设计" />
        </figure>
      </section>

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
          <img src="/cosmos42/logo.png" alt="宇宙放映" />
          <span>42</span>
        </a>
        <p>cosmosfilm42 · 宇宙观影团</p>
        <p>© 2026</p>
      </footer>
    </main>
  );
}
