"use client";
import { useEffect, useState, type FormEvent } from "react";
import { archiveFilms, archiveSectionLabels, type ArchiveSection } from "./archive-data";
import CardCreationsAdmin from "./card-creations-admin";
import ArchiveContentStudio from "./archive-content-studio";
import { getArchiveAdminUrl, isCloudBaseConfigured, signInArchiveUser, signOutArchiveUser, type ArchiveRole } from "./cloudbase-archive";

export default function ArchiveAdminPage() {
  const [editor, setEditor] = useState<{ username: string; role: ArchiveRole } | null>(null);
  const [configured, setConfigured] = useState(false);
  const [hostedAdminUrl, setHostedAdminUrl] = useState<string | null>(null);
  const [needsSecureHost, setNeedsSecureHost] = useState(false);
  const [message, setMessage] = useState("正在连接内容后台…");
  const [loggingIn, setLoggingIn] = useState(false);
  const [film, setFilm] = useState(archiveFilms[1].slug);
  const [section, setSection] = useState<ArchiveSection>("photos");
  const [community, setCommunity] = useState(false);
  useEffect(() => {
    Promise.all([isCloudBaseConfigured(), getArchiveAdminUrl()]).then(([ready, url]) => {
      const needsHost = Boolean(url && new URL(url).origin !== window.location.origin);
      setHostedAdminUrl(url); setNeedsSecureHost(needsHost); setConfigured(ready && !needsHost);
      setMessage(needsHost ? "请从内容后台专用地址登录。" : ready ? "请使用分配的账号登录。" : "内容后台暂时未连接，请稍后重试。");
    }).catch(() => setMessage("连接失败，请刷新后重试。"));
  }, []);
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget); setLoggingIn(true);
    try { setEditor(await signInArchiveUser(String(form.get("username")), String(form.get("password")))); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : "登录失败"); }
    finally { setLoggingIn(false); }
  };
  const navigate = (action: () => void) => {
    const event = new Event("cms-before-navigate", { cancelable: true });
    if (window.dispatchEvent(event)) action();
  };
  if (!editor) return <main className="archive-page archive-admin-page archive-login-page"><header className="archive-header"><a href="/archive/" className="archive-back-link">← 返回往期活动</a><div className="archive-header-title"><span>CONTENT DESK</span><strong>内容后台</strong></div></header><section className="archive-login-screen"><div className="archive-login-copy"><span>COSMOS FILMS / EDITOR</span><h1>登录以后，<br />开始记录这场电影。</h1><p>管理活动照片，编写与发布图文。</p></div><form className="archive-login-form archive-login-panel" onSubmit={login}><div className="archive-form-heading"><span>SIGN IN</span><h2>编辑登录</h2></div>{needsSecureHost && hostedAdminUrl && <a className="archive-admin-safe-link" href={hostedAdminUrl}>进入内容后台 ↗</a>}<label><span>账号</span><input name="username" autoComplete="username" required /></label><label><span>密码</span><input name="password" type="password" autoComplete="current-password" required /></label><button type="submit" disabled={!configured || loggingIn}>{loggingIn ? "登录中…" : "进入内容工作台"}</button><p role="status">{message}</p></form></section></main>;
  const activeFilm = archiveFilms.find(item => item.slug === film)!;
  return <main className="archive-admin-workspace cms-workspace"><header className="archive-workspace-topbar"><a href="/archive/" className="archive-workspace-brand"><span>COSMOS</span><strong>宇宙放映内容台</strong></a><div className="archive-workspace-crumb">ISSUE {activeFilm.issue} · {activeFilm.zhTitle}</div><div className="archive-workspace-account"><strong>{editor.username}</strong><button type="button" onClick={() => navigate(() => { void signOutArchiveUser().then(() => setEditor(null)); })}>退出</button></div></header><div className="cms-shell"><aside className="archive-workspace-nav"><div className="archive-nav-heading"><strong>内容管理</strong></div><section><h2>选择场次</h2><div className="archive-film-nav">{archiveFilms.map(item => <button type="button" key={item.slug} className={film === item.slug && !community ? "is-active" : ""} onClick={() => navigate(() => { setFilm(item.slug); setCommunity(false); })}><span>{item.issue}</span><strong>{item.zhTitle}</strong></button>)}</div></section><section><h2>活动内容</h2><div className="archive-section-nav">{(["photos", "articles", "merch", "tools"] as ArchiveSection[]).map((key, index) => <button type="button" key={key} disabled={editor.role === "photo-uploader" && key !== "photos"} className={!community && section === key ? "is-active" : ""} onClick={() => navigate(() => { setSection(key); setCommunity(false); })}><span>0{index + 1}</span><strong>{key === "articles" ? "图文内容" : archiveSectionLabels[key].zh}</strong></button>)}</div></section>{editor.role === "admin" && <section><h2>玩家作品</h2><div className="archive-section-nav"><button type="button" className={community ? "is-active" : ""} onClick={() => navigate(() => setCommunity(true))}><strong>身份卡与暗杀名单</strong></button></div></section>}</aside>{community ? <CardCreationsAdmin role={editor.role} /> : <ArchiveContentStudio key={film + ":" + section} film={film} section={section} username={editor.username} role={editor.role} />}</div></main>;
}
