"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { type ArchiveFilm } from "./archive-data";
import { eventHref, monthDays } from "./archive-events";
import { loadArchiveEvents, loadArchivePresentations } from "./cloudbase-archive";
import type { ArchivePresentation } from "./archive-presentation";

export function ActivityTimeline({ films, presentations = {} }: { films: ArchiveFilm[]; presentations?: Record<string, ArchivePresentation> }) {
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date()).slice(0, 7));
  const [day, setDay] = useState("");
  const dated = films.filter(film => film.date).sort((a, b) => b.date!.localeCompare(a.date!));
  const visible = day ? dated.filter(film => film.date === day) : dated;
  const shiftMonth = (direction: number) => {
    const [year, value] = month.split("-").map(Number);
    const next = new Date(year, value - 1 + direction, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`); setDay("");
  };
  return <section className="activity-calendar-timeline" aria-label="活动日历与时间线">
    <aside className="activity-calendar"><header><button type="button" aria-label="上个月" disabled={!month} onClick={() => shiftMonth(-1)}>←</button><label><span className="activity-sr-only">选择月份</span><input type="month" value={month} onChange={event => { if (event.target.value) { setMonth(event.target.value); setDay(""); } }} /></label><button type="button" aria-label="下个月" disabled={!month} onClick={() => shiftMonth(1)}>→</button></header>
      <div className="activity-weekdays">{["一", "二", "三", "四", "五", "六", "日"].map(value => <span key={value}>{value}</span>)}</div>
      <div className="activity-days">{month && monthDays(month).map((date, index) => {
        const items = date ? dated.filter(film => film.date === date) : [];
        return date ? <button type="button" key={date} className={`${items.length ? "has-event" : ""}${day === date ? " is-selected" : ""}`} disabled={!items.length} aria-label={`${date}${items.length ? `，${items.length} 场活动：${items.map(item => item.zhTitle).join("、")}` : "，无活动"}`} aria-pressed={day === date} onClick={() => setDay(value => value === date ? "" : date)}><span>{Number(date.slice(-2))}</span>{items.length > 0 && <i aria-hidden="true" />}</button> : <span key={`blank-${index}`} />;
      })}</div><p><i /> 圆点代表当天有活动</p>{day && <button type="button" className="activity-reset" onClick={() => setDay("")}>查看全部日期</button>}
      {dated.length > 0 && <label className="activity-jump">跳到活动月份<select value={month} onChange={event => { setMonth(event.target.value); setDay(""); }}><option value={month}>{month}</option>{[...new Set(dated.map(film => film.date!.slice(0, 7)))].filter(value => value !== month).map(value => <option key={value}>{value}</option>)}</select></label>}
    </aside>
    <div className="activity-timeline"><header><span>SCREENING DIARY</span><h2>{day || "活动时间线"}</h2></header>{!visible.length && <p className="activity-empty">{dated.length ? "这一天暂无活动。" : "活动日期补充后，将在这里留下记录。"}</p>}
      {visible.map(film => <article className="activity-timeline-item" key={film.slug}><time dateTime={film.date}>{film.date}</time><div className="activity-timeline-card"><a className="activity-timeline-cover" href={eventHref(film.slug)}><img src={presentations[film.slug]?.poster || film.poster} alt={film.posterAlt} loading="lazy" style={{ objectPosition: `${presentations[film.slug]?.posterX ?? 50}% ${presentations[film.slug]?.posterY ?? 50}%` }} /></a><div><small>ISSUE {film.issue}</small><h3><a href={eventHref(film.slug)}>{film.zhTitle}</a></h3>{film.location && <p>{film.location}</p>}{film.summary && <p>{film.summary}</p>}<nav aria-label={`${film.zhTitle}活动资料`}><a href={eventHref(film.slug, "articles")}>文章</a><a href={eventHref(film.slug, "photos")}>映后图片</a><a href={eventHref(film.slug, "merch")}>物料图片</a></nav></div></div></article>)}
    </div>
  </section>;
}

export default function HomeActivityTimeline() {
  const [films, setFilms] = useState<ArchiveFilm[]>([]);
  const [presentations, setPresentations] = useState<Record<string, ArchivePresentation>>({});
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([loadArchiveEvents(), loadArchivePresentations()]).then(([films, layouts]) => { if (active) { setFilms(films); setPresentations(layouts); } }).catch(() => { if (active) setError("活动暂时无法加载，请刷新重试。"); });
    return () => { active = false; };
  }, []);
  return <section className="home-activity-section" id="activity-calendar"><div className="home-activity-heading"><h2>每一次相聚</h2><a href="/archive/">全部活动 ↗</a></div>{error ? <p role="alert">{error}</p> : <ActivityTimeline films={films} presentations={presentations} />}</section>;
}
