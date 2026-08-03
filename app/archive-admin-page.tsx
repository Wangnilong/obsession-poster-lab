"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- shared static EdgeOne/Vite routes */

import { useState, type FormEvent } from "react";
import { archiveFilms, archiveSectionLabels, type ArchiveSection } from "./archive-data";

type LoginState = "idle" | "loading" | "error";

export default function ArchiveAdminPage() {
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("后台接口正在等待腾讯云 CloudBase 环境接入。");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoginState("loading");
    setMessage("正在连接内容后台…");

    try {
      const response = await fetch("/api/archive/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
        }),
      });

      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("application/json")) {
        throw new Error("not-connected");
      }

      setMessage("登录成功。内容后台已连接。");
      setLoginState("idle");
    } catch {
      setLoginState("error");
      setMessage("登录接口尚未启用：需要先创建并连接 CloudBase 环境，现有网页与档案不受影响。");
    }
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

        <form className="archive-login-form" onSubmit={handleLogin}>
          <div className="archive-form-heading">
            <span>01 / SIGN IN</span>
            <h2>编辑登录</h2>
          </div>
          <label>
            <span>账号</span>
            <input name="username" autoComplete="username" required placeholder="编辑账号" />
          </label>
          <label>
            <span>密码</span>
            <input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" />
          </label>
          <button type="submit" disabled={loginState === "loading"}>
            {loginState === "loading" ? "连接中…" : "登录内容后台"}
          </button>
          <p className={loginState === "error" ? "is-error" : ""}>{message}</p>
        </form>

        <section className="archive-upload-preview" aria-labelledby="upload-preview-title">
          <div className="archive-form-heading">
            <span>02 / PUBLISH</span>
            <h2 id="upload-preview-title">发布内容</h2>
          </div>
          <fieldset disabled>
            <label>
              <span>对应电影</span>
              <select defaultValue={archiveFilms[0].slug}>
                {archiveFilms.map((film) => <option key={film.slug} value={film.slug}>ISSUE {film.issue} · {film.title}</option>)}
              </select>
            </label>
            <label>
              <span>内容分页</span>
              <select defaultValue="articles">
                {(Object.keys(archiveSectionLabels) as ArchiveSection[]).map((key) => (
                  <option key={key} value={key}>{archiveSectionLabels[key].zh}</option>
                ))}
              </select>
            </label>
            <label className="archive-field-wide">
              <span>标题</span>
              <input placeholder="内容标题" />
            </label>
            <label className="archive-field-wide">
              <span>正文 / 说明</span>
              <textarea rows={5} placeholder="文章正文、图片说明或工具介绍" />
            </label>
            <label className="archive-field-wide">
              <span>图片或文件</span>
              <input type="file" accept="image/*,.pdf,.doc,.docx" />
            </label>
            <button type="button">发布到对应分页</button>
          </fieldset>
          <p>完成 CloudBase 登录、数据库和云存储配置后，这个表单会自动解锁。</p>
        </section>
      </section>
    </main>
  );
}
