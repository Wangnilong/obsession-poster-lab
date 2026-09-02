"use client";

/* eslint-disable @next/next/no-img-element -- CloudBase returns signed image URLs */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadAdminCardCreations,
  setCardCreationStatus,
  type AdminCardCreation,
  type ArchiveRole,
} from "./cloudbase-archive";

export default function CardCreationsAdmin({ role }: { role: ArchiveRole }) {
  const [cards, setCards] = useState<AdminCardCreation[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");
  const [changingId, setChangingId] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setState("loading");
    try {
      setCards(await loadAdminCardCreations(role));
      setState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "用户作品加载失败");
      setState("error");
    }
  }, [role]);

  useEffect(() => {
    let active = true;
    loadAdminCardCreations(role).then((result) => {
      if (!active) return;
      setCards(result);
      setState("ready");
    }).catch((error) => {
      if (!active) return;
      setMessage(error instanceof Error ? error.message : "用户作品加载失败");
      setState("error");
    });
    return () => { active = false; };
  }, [role]);

  const stats = useMemo(() => ({
    total: cards.length,
    published: cards.filter((card) => card.status === "published").length,
    deathLists: cards.filter((card) => card.cardType === "death-list").length,
    licenses: cards.filter((card) => card.cardType === "killer-license").length,
  }), [cards]);

  const changeStatus = async (card: AdminCardCreation) => {
    const nextStatus = card.status === "published" ? "hidden" : "published";
    setChangingId(card.id);
    setMessage("");
    try {
      await setCardCreationStatus(role, card.id, nextStatus);
      setCards((current) => current.map((item) => item.id === card.id ? { ...item, status: nextStatus } : item));
      setMessage(nextStatus === "hidden" ? "作品已从公开墙隐藏，后台记录仍然保留。" : "作品已恢复公开展示。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败，请稍后再试");
    } finally {
      setChangingId(null);
    }
  };

  return (
    <section className="archive-community-admin" aria-labelledby="community-admin-title">
      <header>
        <div><span>COMMUNITY RECORDS</span><h2 id="community-admin-title">用户作品</h2><p>这里自动汇总所有选择“公开展示”的暗杀名单与身份卡；仅保存到手机的作品不会上传。</p></div>
        <button type="button" onClick={() => void loadCards()} disabled={state === "loading"}>{state === "loading" ? "同步中…" : "刷新数据"}</button>
      </header>

      <div className="archive-community-stats" aria-label="作品统计">
        <article><span>全部提交</span><strong>{stats.total}</strong></article>
        <article><span>公开展示</span><strong>{stats.published}</strong></article>
        <article><span>暗杀名单</span><strong>{stats.deathLists}</strong></article>
        <article><span>身份卡</span><strong>{stats.licenses}</strong></article>
      </div>

      {message ? <p className="archive-community-message" role="status">{message}</p> : null}
      {state === "error" ? <button className="archive-community-retry" type="button" onClick={() => void loadCards()}>重新加载</button> : null}
      {state === "ready" && cards.length === 0 ? <div className="archive-community-admin-empty"><span>NO SUBMISSIONS</span><strong>还没有公开作品。</strong></div> : null}
      {cards.length ? <div className="archive-community-admin-grid">
        {cards.map((card) => <article key={card.id} className={card.status === "hidden" ? "is-hidden" : ""}>
          <div className={card.cardType === "death-list" ? "is-poster" : "is-license"}>{card.image ? <img src={card.image} alt={`${card.displayName} 的作品`} /> : <span>图片链接已过期，点击刷新</span>}</div>
          <footer>
            <span>{card.cardType === "death-list" ? "暗杀名单" : "杀手身份卡"}</span>
            <strong>{card.displayName}</strong>
            <time>{new Date(card.createdAt).toLocaleString("zh-CN")}</time>
            <button type="button" disabled={changingId === card.id} onClick={() => void changeStatus(card)}>{changingId === card.id ? "处理中…" : card.status === "published" ? "从作品墙隐藏" : "恢复公开展示"}</button>
          </footer>
        </article>)}
      </div> : null}
    </section>
  );
}
