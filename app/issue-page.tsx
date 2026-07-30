/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- static EdgeOne/Vite routes use portable anchors */
import type { CSSProperties } from "react";
import { currentIssue } from "../src/editorial";

const issueStyle = {
  "--issue-accent": currentIssue.accent,
  "--issue-accent-dark": currentIssue.accentDark,
  "--issue-paper": currentIssue.paper,
} as CSSProperties;

export default function IssuePage() {
  return (
    <main className="cf42-issue" style={issueStyle}>
      <header className="cf42-header cf42-issue-header">
        <a className="cf42-brand" href="/" aria-label="返回 cosmosfilm42 首页">
          <strong>cosmosfilm42</strong>
          <span>宇宙观影团</span>
        </a>
        <nav aria-label="专题页导航">
          <a href="/#current">本期</a>
          <a href="/#archive">往期</a>
          <a href="/#about">关于</a>
        </nav>
      </header>

      <article>
        <header className="cf42-article-hero">
          <div className="cf42-article-heading">
            <p className="cf42-mono">VOL.{currentIssue.number} / EDITORIAL</p>
            <h1>
              花为什么
              <br />
              <em>挡住了脸</em>
            </h1>
            <p className="cf42-article-deck">
              从《Obsession》的原版海报开始，谈一场关于凝视、占有和消失的观影。
            </p>
          </div>
          <figure className="cf42-article-poster">
            <img
              src={currentIssue.poster}
              width={795}
              height={1194}
              alt="Obsession 原版电影海报"
            />
            <figcaption>
              <span>ISSUE {currentIssue.number}</span>
              <span>{currentIssue.dateLabel}</span>
            </figcaption>
          </figure>
        </header>

        <div className="cf42-article-body">
          <aside className="cf42-article-index">
            <span>READING INDEX</span>
            <ol>
              <li>01 / 一张拒绝露脸的海报</li>
              <li>02 / 手、花瓶与占有</li>
              <li>03 / 从观看到进入画面</li>
            </ol>
          </aside>

          <div className="cf42-prose">
            <section>
              <p className="cf42-dropcap">
                一
                <span>
                  张脸消失了。取代它的是一束过于盛大的花。观众首先看到的不是人物，而是遮挡；
                  不是表情，而是一种拒绝被读懂的姿态。
                </span>
              </p>
              <p>
                《Obsession》的海报没有解释人物是谁。它把最应该提供信息的位置留成了谜。
                花束越具体，人物反而越不可见。我们想保留的，正是这种无法立刻得到答案的感觉。
              </p>
            </section>

            <blockquote>
              “当脸被遮住，双手就成为画面里最诚实的部分。”
            </blockquote>

            <section>
              <h2>手、花瓶与占有</h2>
              <p>
                两只手紧紧抱住花瓶，既像保护，也像控制。红色只停留在指尖和花瓣边缘，
                让整张图处在温柔与危险之间。它不是一张漂亮的肖像，而是一段没有说完的关系。
              </p>
              <p>
                所以第一期的互动没有要求参与者“扮演角色”。我们只给出位置：花在哪里、手在哪里、
                人如何站进画面。剩下的部分，由每个人自己的身体完成。
              </p>
            </section>

            <section className="cf42-experience-callout">
              <span>INTERACTIVE / 01</span>
              <h2>现在，轮到你进入画面。</h2>
              <p>相机、参考线、定时拍照和海报滤镜都在手机本地完成。</p>
              <a href={currentIssue.experienceHref}>打开 Obsession 海报暗房 ↗</a>
            </section>

            <section>
              <h2>关于这一期</h2>
              <p>
                cosmosfilm42 会随着每一期电影改变颜色、排版和小元素。下一部电影到来时，
                首页也会变成另一种气候；这篇文章和本期的互动页面则会继续留在档案里。
              </p>
            </section>
          </div>
        </div>
      </article>

      <section className="cf42-ticket-strip" id="tickets">
        <div>
          <span>TICKETS / WECHAT</span>
          <strong>{currentIssue.ticket.label}</strong>
        </div>
        <span aria-hidden="true">↗</span>
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
