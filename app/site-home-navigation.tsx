"use client";
import { useEffect, useState } from "react";
import { loadArchiveEvents } from "./cloudbase-archive";
import type { ArchiveFilm } from "./archive-data";
export default function SiteHomeNavigation() {
  const [tickets, setTickets] = useState<ArchiveFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadArchiveEvents().then(events => { if (active) setTickets(events.filter(event => event.ticketUrl)); }).catch(() => { if (active) setFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <nav aria-label="主页导航" className="intro42-main-nav"><a href="/archive/">往期活动</a><button type="button" disabled title="小评论区稍后开放">小评论区<small>稍后开放</small></button>
    {tickets.length === 1 ? <a href={tickets[0].ticketUrl} title={`${tickets[0].zhTitle} · 前往购票`}>买票 ↗</a> : tickets.length > 1 ? <details className="intro42-ticket-menu"><summary>买票 ↗</summary><div>{tickets.map(event => <a key={event.slug} href={event.ticketUrl}>{event.zhTitle}{event.date && <small>{event.date}</small>}</a>)}</div></details> : <button type="button" disabled title={loading ? "正在加载购票信息" : failed ? "购票信息加载失败，请刷新重试" : "购票入口即将开放"}>买票<small>{loading ? "加载中" : failed ? "请刷新重试" : "待开放"}</small></button>}
  </nav>;
}
