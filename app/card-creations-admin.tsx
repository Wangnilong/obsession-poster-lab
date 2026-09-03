"use client";

/* eslint-disable @next/next/no-img-element -- CloudBase returns signed image URLs */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadAllCardCreations,
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
  const [downloadingAll, setDownloadingAll] = useState(false);

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
    published: cards.filter((card) => card.visibility === "public" && card.status === "published").length,
    private: cards.filter((card) => card.visibility === "private").length,
    hidden: cards.filter((card) => card.visibility === "public" && card.status === "hidden").length,
  }), [cards]);

  const changeStatus = async (card: AdminCardCreation) => {
    if (card.visibility !== "public") return;
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

  const downloadAll = async () => {
    if (!cards.length || downloadingAll) return;
    setDownloadingAll(true);
    setMessage("正在把全部小卡打包，请稍等…");
    try {
      const result = await downloadAllCardCreations(role);
      const anchor = document.createElement("a");
      anchor.href = result.downloadUrl;
      anchor.download = result.filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setMessage(`已打包 ${result.count} 张小卡，下载已经开始。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片打包失败，请稍后再试");
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <section className="archive-community-admin" aria-labelledby="community-admin-title">
      <header>
        <div><span>KILLER LICENSE RECORDS</span><h2 id="community-admin-title">用户小卡</h2><p>这里保存所有完成过“保存到手机”或“公开展示”的身份小卡。用户不公开的内容只在后台可见，不会进入作品墙。</p></div>
        <div className="archive-community-actions">
          <button type="button" className="is-download" onClick={() => void downloadAll()} disabled={!cards.length || downloadingAll}>{downloadingAll ? "正在打包…" : "一键下载全部图片"}</button>
          <button type="button" onClick={() => void loadCards()} disabled={state === "loading"}>{state === "loading" ? "同步中…" : "刷新数据"}</button>
        </div>
      </header>

      <div className="archive-community-stats" aria-label="作品统计">
        <article><span>全部提交</span><strong>{stats.total}</strong></article>
        <article><span>公开展示</span><strong>{stats.published}</strong></article>
        <article><span>仅后台留档</span><strong>{stats.private}</strong></article>
        <article><span>管理员隐藏</span><strong>{stats.hidden}</strong></article>
      </div>

      {message ? <p className="archive-community-message" role="status">{message}</p> : null}
      {state === "error" ? <button className="archive-community-retry" type="button" onClick={() => void loadCards()}>重新加载</button> : null}
      {state === "ready" && cards.length === 0 ? <div className="archive-community-admin-empty"><span>NO SUBMISSIONS</span><strong>还没有用户小卡。</strong></div> : null}
      {cards.length ? <div className="archive-community-admin-grid">
        {cards.map((card) => <article key={card.id} className={card.visibility === "public" && card.status === "hidden" ? "is-hidden" : ""}>
          <div className="is-license">{card.image ? <img src={card.image} alt={`${card.displayName} 的身份小卡`} /> : <span>图片链接已过期，点击刷新</span>}</div>
          <footer>
            <span>{card.visibility === "public" ? (card.status === "published" ? "作品墙公开" : "管理员已隐藏") : "用户选择不公开"}</span>
            <strong>{card.displayName}</strong>
            <time>{new Date(card.createdAt).toLocaleString("zh-CN")}</time>
            {card.image ? <a href={card.image} target="_blank" rel="noreferrer">下载此图</a> : null}
            {card.visibility === "public" ? <button type="button" disabled={changingId === card.id} onClick={() => void changeStatus(card)}>{changingId === card.id ? "处理中…" : card.status === "published" ? "从作品墙隐藏" : "恢复公开展示"}</button> : <p>仅后台可见</p>}
          </footer>
        </article>)}
      </div> : null}
    </section>
  );
}
