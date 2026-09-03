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

type CardModule = AdminCardCreation["cardType"];

const moduleCopy: Record<CardModule, { eyebrow: string; title: string; description: string; noun: string }> = {
  "killer-license": {
    eyebrow: "KILLER LICENSE RECORDS",
    title: "身份小卡",
    description: "保存所有完成过“保存到手机”或“公开展示”的身份小卡。只有用户主动公开的内容才会进入作品墙。",
    noun: "身份小卡",
  },
  "death-list": {
    eyebrow: "DEATH LIST RECORDS",
    title: "暗杀名单",
    description: "保存所有下载过的暗杀名单，供管理员查看与统一下载。这个模块永远不会展示在公开作品墙。",
    noun: "暗杀名单",
  },
};

export default function CardCreationsAdmin({ role }: { role: ArchiveRole }) {
  const [cards, setCards] = useState<AdminCardCreation[]>([]);
  const [activeModule, setActiveModule] = useState<CardModule>("killer-license");
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

  const moduleCounts = useMemo(() => ({
    "killer-license": cards.filter((card) => card.cardType === "killer-license").length,
    "death-list": cards.filter((card) => card.cardType === "death-list").length,
  }), [cards]);

  const visibleCards = useMemo(
    () => cards.filter((card) => card.cardType === activeModule),
    [activeModule, cards],
  );

  const stats = useMemo(() => activeModule === "death-list" ? [
    { label: "全部名单", value: visibleCards.length },
    { label: "目标为 BILL", value: visibleCards.filter((card) => card.displayName.trim().toUpperCase() === "BILL").length },
    { label: "自定义目标", value: visibleCards.filter((card) => card.displayName.trim().toUpperCase() !== "BILL").length },
    { label: "作品墙展示", value: 0 },
  ] : [
    { label: "全部小卡", value: visibleCards.length },
    { label: "公开展示", value: visibleCards.filter((card) => card.visibility === "public" && card.status === "published").length },
    { label: "仅后台留档", value: visibleCards.filter((card) => card.visibility === "private").length },
    { label: "管理员隐藏", value: visibleCards.filter((card) => card.visibility === "public" && card.status === "hidden").length },
  ], [activeModule, visibleCards]);

  const changeStatus = async (card: AdminCardCreation) => {
    if (card.cardType !== "killer-license" || card.visibility !== "public") return;
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
    if (!visibleCards.length || downloadingAll) return;
    setDownloadingAll(true);
    setMessage(`正在打包全部${moduleCopy[activeModule].noun}，请稍等…`);
    try {
      const result = await downloadAllCardCreations(role, activeModule);
      const anchor = document.createElement("a");
      anchor.href = result.downloadUrl;
      anchor.download = result.filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setMessage(`已打包 ${result.count} 张${moduleCopy[activeModule].noun}，下载已经开始。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图片打包失败，请稍后再试");
    } finally {
      setDownloadingAll(false);
    }
  };

  const copy = moduleCopy[activeModule];

  return (
    <section className="archive-community-admin" aria-labelledby="community-admin-title">
      <header>
        <div><span>{copy.eyebrow}</span><h2 id="community-admin-title">{copy.title}</h2><p>{copy.description}</p></div>
        <div className="archive-community-actions">
          <button type="button" className="is-download" onClick={() => void downloadAll()} disabled={!visibleCards.length || downloadingAll}>{downloadingAll ? "正在打包…" : `一键下载全部${copy.noun}`}</button>
          <button type="button" onClick={() => void loadCards()} disabled={state === "loading"}>{state === "loading" ? "同步中…" : "刷新数据"}</button>
        </div>
      </header>

      <nav className="archive-community-modules" aria-label="用户作品模块">
        <button type="button" className={activeModule === "killer-license" ? "is-active" : ""} onClick={() => { setActiveModule("killer-license"); setMessage(""); }}><span>01</span><strong>身份小卡</strong><b>{moduleCounts["killer-license"]}</b></button>
        <button type="button" className={activeModule === "death-list" ? "is-active" : ""} onClick={() => { setActiveModule("death-list"); setMessage(""); }}><span>02</span><strong>暗杀名单</strong><b>{moduleCounts["death-list"]}</b></button>
      </nav>

      <div className="archive-community-stats" aria-label={`${copy.title}统计`}>
        {stats.map((stat) => <article key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></article>)}
      </div>

      {message ? <p className="archive-community-message" role="status">{message}</p> : null}
      {state === "error" ? <button className="archive-community-retry" type="button" onClick={() => void loadCards()}>重新加载</button> : null}
      {state === "ready" && visibleCards.length === 0 ? <div className="archive-community-admin-empty"><span>NO SUBMISSIONS</span><strong>还没有{copy.noun}。</strong></div> : null}
      {visibleCards.length ? <div className="archive-community-admin-grid">
        {visibleCards.map((card) => {
          const isDeathList = card.cardType === "death-list";
          return <article key={card.id} className={!isDeathList && card.visibility === "public" && card.status === "hidden" ? "is-hidden" : ""}>
            <div className={isDeathList ? "is-poster" : "is-license"}>{card.image ? <img src={card.image} alt={`${card.displayName} 的${isDeathList ? "暗杀名单" : "身份小卡"}`} /> : <span>图片链接已过期，点击刷新</span>}</div>
            <footer>
              <span>{isDeathList ? "仅后台保存" : card.visibility === "public" ? (card.status === "published" ? "作品墙公开" : "管理员已隐藏") : "用户选择不公开"}</span>
              <strong>{card.displayName}</strong>
              <time>{new Date(card.createdAt).toLocaleString("zh-CN")}</time>
              {card.image ? <a href={card.image} target="_blank" rel="noreferrer">下载此图</a> : null}
              {isDeathList ? <p>不展示到作品墙</p> : card.visibility === "public" ? <button type="button" disabled={changingId === card.id} onClick={() => void changeStatus(card)}>{changingId === card.id ? "处理中…" : card.status === "published" ? "从作品墙隐藏" : "恢复公开展示"}</button> : <p>仅后台可见</p>}
            </footer>
          </article>;
        })}
      </div> : null}
    </section>
  );
}
