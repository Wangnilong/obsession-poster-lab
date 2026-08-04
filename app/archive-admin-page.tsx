"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- shared static EdgeOne/Vite routes */

import { useEffect, useState, type FormEvent } from "react";
import { archiveFilms, archiveSectionLabels, type ArchiveSection } from "./archive-data";
import {
  getArchiveAdminUrl,
  isCloudBaseConfigured,
  publishArchiveContent,
  signInArchiveUser,
  signOutArchiveUser,
  type ArchiveRole,
} from "./cloudbase-archive";

type LoginState = "idle" | "loading" | "error" | "success";
type SignedInEditor = { username: string; role: ArchiveRole };

export default function ArchiveAdminPage() {
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [configured, setConfigured] = useState(false);
  const [hostedAdminUrl, setHostedAdminUrl] = useState<string | null>(null);
  const [needsSecureHost, setNeedsSecureHost] = useState(false);
  const [editor, setEditor] = useState<SignedInEditor | null>(null);
  const [message, setMessage] = useState("正在检查腾讯云内容后台…");
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");

  useEffect(() => {
    Promise.all([isCloudBaseConfigured(), getArchiveAdminUrl()]).then(([ready, adminUrl]) => {
      setHostedAdminUrl(adminUrl);
      const secureOrigin = adminUrl ? new URL(adminUrl).origin : null;
      const requiresHostedOrigin = Boolean(secureOrigin && secureOrigin !== window.location.origin);
      setNeedsSecureHost(requiresHostedOrigin);
      setConfigured(ready && !requiresHostedOrigin);
      setMessage(requiresHostedOrigin
        ? "腾讯云免费版要求编辑后台从安全域名打开。公开网站仍保持在 cosmosfilm42.cn。"
        : ready
          ? "内容后台已连接，请使用分配的账号登录。"
          : "免费 CloudBase 环境尚未完成创建。");
    });
  }, []);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    setLoginState("loading");
    setMessage("正在验证账号…");

    try {
      const signedIn = await signInArchiveUser(username, password);
      setEditor(signedIn);
      setLoginState("success");
      setMessage(signedIn.role === "admin" ? "已获得全部内容管理权限。" : "已登录：仅允许上传映后图片。");
      formElement.reset();
    } catch (error) {
      setLoginState("error");
      setMessage(error instanceof Error ? error.message : "登录失败，请检查账号或密码。");
    }
  };

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const section = editor.role === "photo-uploader" ? "photos" : String(form.get("section")) as ArchiveSection;
    const file = form.get("file");
    setPublishing(true);
    setPublishMessage("正在上传并发布…");

    try {
      await publishArchiveContent({
        username: editor.username,
        role: editor.role,
        film: String(form.get("film")),
        section,
        title: String(form.get("title")),
        copy: String(form.get("copy") ?? ""),
        href: String(form.get("href") ?? ""),
        file: file instanceof File && file.size ? file : null,
      });
      formElement.reset();
      setPublishMessage("发布成功。刷新对应电影分页即可看到新内容。");
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "发布失败，请稍后再试。");
    } finally {
      setPublishing(false);
    }
  };

  const handleSignOut = async () => {
    await signOutArchiveUser();
    setEditor(null);
    setLoginState("idle");
    setMessage("已退出内容后台。");
  };

  return (
    <main className="archive-page archive-admin-page">
      <header className="archive-header">
        <a href="/archive/" className="archive-back-link">← 返回往期活动</a>
        <div className="archive-header-title">
          <span>CONTENT DESK</span>
          <strong>内容后台</strong>
        </div>
        <a href="/" className="archive-login-link">宇宙放映 ↗</a>
      </header>

      <section className="archive-admin-shell">
        <div className="archive-admin-intro">
          <span>FOR COSMOS FILMS EDITORS</span>
          <h1>每部电影，<br />各自继续生长。</h1>
          <p>登录以后，先选择电影和内容分页，再上传文章、图片、工具或周边。公开页面不会再把所有内容堆在一起。</p>
        </div>

        {!editor ? (
          <form className="archive-login-form" onSubmit={handleLogin}>
            <div className="archive-form-heading">
              <span>01 / SIGN IN</span>
              <h2>编辑登录</h2>
            </div>
            {needsSecureHost && hostedAdminUrl ? (
              <a className="archive-admin-safe-link" href={hostedAdminUrl}>进入腾讯云安全后台 ↗</a>
            ) : null}
            <label>
              <span>账号</span>
              <input name="username" autoComplete="username" required placeholder="编辑账号" />
            </label>
            <label>
              <span>密码</span>
              <input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
            </label>
            <button type="submit" disabled={!configured || loginState === "loading"}>
              {loginState === "loading" ? "验证中…" : "登录内容后台"}
            </button>
            <p className={loginState === "error" ? "is-error" : ""}>{message}</p>
          </form>
        ) : (
          <section className="archive-login-form archive-session-card">
            <div className="archive-form-heading">
              <span>01 / SIGNED IN</span>
              <h2>{editor.username}</h2>
            </div>
            <strong className="archive-role-badge">{editor.role === "admin" ? "最高权限" : "仅上传图片"}</strong>
            <p>{message}</p>
            <button type="button" onClick={handleSignOut}>退出登录</button>
          </section>
        )}

        <section className="archive-upload-preview" aria-labelledby="upload-preview-title">
          <div className="archive-form-heading">
            <span>02 / PUBLISH</span>
            <h2 id="upload-preview-title">发布内容</h2>
          </div>
          <form onSubmit={handlePublish}>
            <fieldset disabled={!editor || publishing}>
              <label>
                <span>对应电影</span>
                <select name="film" defaultValue={archiveFilms[0].slug}>
                  {archiveFilms.map((film) => <option key={film.slug} value={film.slug}>ISSUE {film.issue} · {film.title}</option>)}
                </select>
              </label>
              <label>
                <span>内容分页</span>
                <select name={editor?.role === "photo-uploader" ? undefined : "section"} defaultValue={editor?.role === "photo-uploader" ? "photos" : "articles"} disabled={editor?.role === "photo-uploader"}>
                  {(Object.keys(archiveSectionLabels) as ArchiveSection[]).map((key) => (
                    <option key={key} value={key} disabled={editor?.role === "photo-uploader" && key !== "photos"}>{archiveSectionLabels[key].zh}</option>
                  ))}
                </select>
                {editor?.role === "photo-uploader" ? <input type="hidden" name="section" value="photos" /> : null}
              </label>
              <label className="archive-field-wide">
                <span>标题</span>
                <input name="title" required placeholder="内容标题" />
              </label>
              <label className="archive-field-wide">
                <span>正文 / 说明</span>
                <textarea name="copy" rows={5} placeholder="文章正文、图片说明或工具介绍" />
              </label>
              {editor?.role !== "photo-uploader" ? (
                <label className="archive-field-wide">
                  <span>跳转链接（选填）</span>
                  <input name="href" type="url" placeholder="https://…" />
                </label>
              ) : null}
              <label className="archive-field-wide">
                <span>图片或文件</span>
                <input name="file" type="file" accept="image/*,.pdf,.doc,.docx" required={editor?.role === "photo-uploader"} />
              </label>
              <button type="submit">{publishing ? "正在发布…" : "发布到对应分页"}</button>
            </fieldset>
          </form>
          <p>{editor ? (publishMessage || "内容会保存到腾讯云，并出现在对应电影分页中。") : "登录后发布表单会自动解锁。"}</p>
        </section>
      </section>
    </main>
  );
}
