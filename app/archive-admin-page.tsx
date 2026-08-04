"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- shared static EdgeOne/Vite routes */
/* eslint-disable @next/next/no-img-element -- local previews use object URLs */

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { archiveFilms, archiveSectionLabels, type ArchiveLayoutBlock, type ArchiveSection } from "./archive-data";
import ArchiveLayout from "./archive-layout";
import {
  getArchiveAdminUrl,
  isCloudBaseConfigured,
  publishArchiveContent,
  signInArchiveUser,
  signOutArchiveUser,
  type ArchivePublishBlock,
  type ArchiveRole,
} from "./cloudbase-archive";

type LoginState = "idle" | "loading" | "error" | "success";
type SignedInEditor = { username: string; role: ArchiveRole };
type BlockUpdate = {
  text?: string;
  href?: string;
  align?: "left" | "center" | "right";
  alt?: string;
  caption?: string;
  size?: "full" | "wide" | "half";
};

const sectionHints: Record<ArchiveSection, string> = {
  articles: "用标题、正文、引语和图片搭出文章，拖动内容块决定阅读顺序。",
  photos: "把映后照片直接拖进来；每张图都可以写说明、调整宽度和顺序。",
  tools: "放工具说明、使用步骤、示意图和打开工具的按钮，按实际使用顺序排列。",
  merch: "这里单独放周边实物图、材质尺寸和文字介绍，不和工具混在一起。",
};

function createId() {
  return crypto.randomUUID();
}

function toPreviewBlocks(blocks: ArchivePublishBlock[]): ArchiveLayoutBlock[] {
  return blocks.flatMap((block) => {
    if (block.type === "image") {
      return block.preview ? [{
        type: "image" as const,
        image: block.preview,
        alt: block.alt,
        caption: block.caption,
        size: block.size,
      }] : [];
    }
    if (block.type === "link") return block.text || block.href ? [{ type: "link" as const, text: block.text, href: block.href || "#" }] : [];
    return block.text ? [{ type: block.type, text: block.text, align: block.align }] : [];
  });
}

export default function ArchiveAdminPage() {
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [configured, setConfigured] = useState(false);
  const [hostedAdminUrl, setHostedAdminUrl] = useState<string | null>(null);
  const [needsSecureHost, setNeedsSecureHost] = useState(false);
  const [editor, setEditor] = useState<SignedInEditor | null>(null);
  const [message, setMessage] = useState("正在检查腾讯云内容后台…");
  const [publishing, setPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState("");
  const [film, setFilm] = useState(archiveFilms[0].slug);
  const [section, setSection] = useState<ArchiveSection>("articles");
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<ArchivePublishBlock[]>([]);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [isDroppingFiles, setIsDroppingFiles] = useState(false);

  const previewBlocks = useMemo(() => toPreviewBlocks(blocks), [blocks]);

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
      if (signedIn.role === "photo-uploader") setSection("photos");
      setLoginState("success");
      setMessage(signedIn.role === "admin" ? "已获得全部内容管理权限。" : "已登录：只允许上传映后图片。");
      formElement.reset();
    } catch (error) {
      setLoginState("error");
      setMessage(error instanceof Error ? error.message : "登录失败，请检查账号或密码。");
    }
  };

  const updateBlock = (id: string, update: BlockUpdate) => {
    setBlocks((current) => current.map((block) => block.id === id ? { ...block, ...update } as ArchivePublishBlock : block));
  };

  const addTextBlock = (type: "heading" | "paragraph" | "quote") => {
    setBlocks((current) => [...current, { id: createId(), type, text: "", align: "left" }]);
  };

  const addLinkBlock = () => {
    setBlocks((current) => [...current, { id: createId(), type: "link", text: "", href: "" }]);
  };

  const addImages = (fileList: FileList | File[]) => {
    const nextImages = Array.from(fileList)
      .filter((file) => file.type.startsWith("image/"))
      .map((file): ArchivePublishBlock => ({
        id: createId(),
        type: "image",
        file,
        preview: URL.createObjectURL(file),
        alt: file.name.replace(/\.[^.]+$/, ""),
        caption: "",
        size: "full",
      }));
    if (nextImages.length) {
      setBlocks((current) => [...current, ...nextImages]);
      setPublishMessage(`${nextImages.length} 张图片已加入排版，拖动即可调整位置。`);
    }
  };

  const handleImageInput = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.currentTarget.files) addImages(event.currentTarget.files);
    event.currentTarget.value = "";
  };

  const removeBlock = (id: string) => {
    setBlocks((current) => {
      const target = current.find((block) => block.id === id);
      if (target?.type === "image" && target.preview) URL.revokeObjectURL(target.preview);
      return current.filter((block) => block.id !== id);
    });
  };

  const moveBlock = (id: string, offset: number) => {
    setBlocks((current) => {
      const from = current.findIndex((block) => block.id === id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const moveBlockTo = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setBlocks((current) => {
      const from = current.findIndex((block) => block.id === sourceId);
      const to = current.findIndex((block) => block.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const handleWorkspaceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDroppingFiles(false);
    if (event.dataTransfer.files.length) addImages(event.dataTransfer.files);
  };

  const handleBlockDrop = (event: DragEvent<HTMLElement>, targetId: string) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files.length) {
      addImages(event.dataTransfer.files);
      return;
    }
    if (draggedBlockId) moveBlockTo(draggedBlockId, targetId);
    setDraggedBlockId(null);
  };

  const resetComposer = () => {
    blocks.forEach((block) => {
      if (block.type === "image" && block.preview) URL.revokeObjectURL(block.preview);
    });
    setTitle("");
    setBlocks([]);
  };

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const targetSection = editor.role === "photo-uploader" ? "photos" : section;
    if (!title.trim()) {
      setPublishMessage("先写一个内容标题。");
      return;
    }
    if (!blocks.length) {
      setPublishMessage("画布还是空的，请先加入文字或图片。");
      return;
    }
    if (targetSection === "photos" && !blocks.some((block) => block.type === "image")) {
      setPublishMessage("映后图片分页至少需要一张图片。");
      return;
    }

    setPublishing(true);
    setPublishMessage("正在上传图片并保存排版…");
    try {
      await publishArchiveContent({
        username: editor.username,
        role: editor.role,
        film,
        section: targetSection,
        title,
        blocks,
      });
      resetComposer();
      setPublishMessage("发布成功。你排好的顺序和图片宽度已经出现在对应电影分页。 ");
    } catch (error) {
      setPublishMessage(error instanceof Error ? error.message : "发布失败，请稍后再试。");
    } finally {
      setPublishing(false);
    }
  };

  const handleSignOut = async () => {
    await signOutArchiveUser();
    resetComposer();
    setEditor(null);
    setLoginState("idle");
    setMessage("已退出内容后台。");
  };

  const canComposeText = editor?.role !== "photo-uploader";
  const activeSection: ArchiveSection = editor?.role === "photo-uploader" ? "photos" : section;
  const activeFilm = archiveFilms.find((item) => item.slug === film) ?? archiveFilms[0];

  if (!editor) {
    return (
      <main className="archive-page archive-admin-page archive-login-page">
        <header className="archive-header">
          <a href="/archive/" className="archive-back-link">← 返回往期活动</a>
          <div className="archive-header-title"><span>CONTENT DESK</span><strong>内容后台</strong></div>
          <a href="/" className="archive-login-link">宇宙放映 ↗</a>
        </header>
        <section className="archive-login-screen">
          <div className="archive-login-copy">
            <span>COSMOS FILMS / EDITOR</span>
            <h1>登录以后，<br />再开始排版。</h1>
            <p>文章、映后图片、工具和周边各自成页。公开网站只负责阅读，编辑工作留在这里。</p>
          </div>
          <form className="archive-login-form archive-login-panel" onSubmit={handleLogin}>
            <div className="archive-form-heading"><span>SECURE SIGN IN</span><h2>编辑登录</h2></div>
            {needsSecureHost && hostedAdminUrl ? <a className="archive-admin-safe-link" href={hostedAdminUrl}>进入腾讯云安全后台 ↗</a> : null}
            <label><span>账号</span><input name="username" autoComplete="username" required placeholder="编辑账号" /></label>
            <label><span>密码</span><input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" /></label>
            <button type="submit" disabled={!configured || loginState === "loading"}>{loginState === "loading" ? "验证中…" : "进入内容工作台"}</button>
            <p className={loginState === "error" ? "is-error" : ""}>{message}</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="archive-admin-workspace">
      <header className="archive-workspace-topbar">
        <a href="/archive/" className="archive-workspace-brand"><span>COSMOS</span><strong>宇宙放映内容台</strong></a>
        <div className="archive-workspace-crumb"><span>往期活动</span><b>/</b><strong>ISSUE {activeFilm.issue} · {activeFilm.title}</strong><b>/</b><span>{archiveSectionLabels[activeSection].zh}</span></div>
        <div className="archive-workspace-account"><span>{editor.role === "admin" ? "管理员" : "图片编辑"}</span><strong>{editor.username}</strong><button type="button" onClick={handleSignOut}>退出</button></div>
      </header>

      <form className="archive-workspace-form" onSubmit={handlePublish}>
        <fieldset disabled={publishing}>
          <div className="archive-workspace-grid">
            <aside className="archive-workspace-nav" aria-label="内容导航">
              <div className="archive-nav-heading"><span>CONTENT</span><strong>内容管理</strong></div>
              <section>
                <h2>选择电影</h2>
                <div className="archive-film-nav">
                  {archiveFilms.map((item) => <button type="button" className={film === item.slug ? "is-active" : ""} key={item.slug} onClick={() => setFilm(item.slug)}><span>{item.issue}</span><span><strong>{item.title}</strong><small>ISSUE {item.issue}</small></span></button>)}
                </div>
              </section>
              <section>
                <h2>内容分页</h2>
                <div className="archive-section-nav">
                  {(Object.keys(archiveSectionLabels) as ArchiveSection[]).map((key, index) => {
                    const locked = editor.role === "photo-uploader" && key !== "photos";
                    return <button type="button" className={activeSection === key ? "is-active" : ""} key={key} disabled={locked} onClick={() => setSection(key)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{archiveSectionLabels[key].zh}</strong></button>;
                  })}
                </div>
              </section>
              <p className="archive-nav-hint">{sectionHints[activeSection]}</p>
            </aside>

            <section className="archive-word-editor" aria-labelledby="layout-studio-title">
              <header className="archive-word-ribbon">
                <div className="archive-ribbon-tabs"><strong id="layout-studio-title">开始</strong><span>插入</span><span>布局</span></div>
                <div className="archive-ribbon-tools" aria-label="添加内容块">
                  {canComposeText ? <div className="archive-ribbon-group"><span>文字</span><div><button type="button" onClick={() => addTextBlock("heading")}><b>T</b>小标题</button><button type="button" onClick={() => addTextBlock("paragraph")}><b>¶</b>正文</button><button type="button" onClick={() => addTextBlock("quote")}><b>“</b>引语</button></div></div> : null}
                  <div className="archive-ribbon-group"><span>插入</span><div>{canComposeText ? <button type="button" onClick={addLinkBlock}><b>↗</b>按钮</button> : null}<label className="archive-ribbon-image"><b>▧</b>图片<input type="file" accept="image/*" multiple onChange={handleImageInput} /></label></div></div>
                  <div className="archive-ribbon-group archive-ribbon-meta"><span>当前页面</span><div><b>ISSUE {activeFilm.issue}</b><strong>{archiveSectionLabels[activeSection].zh}</strong></div></div>
                </div>
              </header>

              <div className="archive-document-desk">
                <div className="archive-document-status"><span>{blocks.length} 个内容块</span><span>自动保存：发布时</span></div>
                <article className="archive-document-page">
                  <div className="archive-document-kicker"><span>COSMOS FILMS</span><span>ISSUE {activeFilm.issue} / {archiveSectionLabels[activeSection].en}</span></div>
                  <label className="archive-document-title"><span>内容标题</span><textarea rows={2} value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder={activeSection === "merch" ? "输入周边名称" : "输入这篇内容的标题"} /></label>
                  <div className={`archive-block-canvas archive-document-canvas${isDroppingFiles ? " is-dropping" : ""}`} onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setIsDroppingFiles(true); }} onDragLeave={() => setIsDroppingFiles(false)} onDrop={handleWorkspaceDrop}>
                    {!blocks.length ? (
                      <div className="archive-empty-canvas"><strong>从上方插入内容</strong><span>也可以把一张或多张图片直接拖到这张白纸上</span></div>
                    ) : blocks.map((block, index) => (
                      <article className="archive-editor-block" draggable key={block.id} onDragStart={() => setDraggedBlockId(block.id)} onDragEnd={() => setDraggedBlockId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleBlockDrop(event, block.id)}>
                        <header>
                          <span className="archive-drag-handle">⠿ {String(index + 1).padStart(2, "0")} · {block.type.toUpperCase()}</span>
                          <div><button type="button" aria-label="上移" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}>↑</button><button type="button" aria-label="下移" disabled={index === blocks.length - 1} onClick={() => moveBlock(block.id, 1)}>↓</button><button type="button" aria-label="删除" onClick={() => removeBlock(block.id)}>×</button></div>
                        </header>

                        {block.type === "image" ? (
                          <div className="archive-image-block-editor">
                            {block.preview ? <img src={block.preview} alt="上传预览" /> : null}
                            <div><label><span>图片宽度</span><select value={block.size ?? "full"} onChange={(event) => updateBlock(block.id, { size: event.currentTarget.value as "full" | "wide" | "half" })}><option value="full">通栏</option><option value="wide">宽版</option><option value="half">半版</option></select></label><label><span>图片说明</span><input value={block.caption ?? ""} onChange={(event) => updateBlock(block.id, { caption: event.currentTarget.value })} placeholder="显示在图片下面" /></label><label><span>替代文字</span><input value={block.alt ?? ""} onChange={(event) => updateBlock(block.id, { alt: event.currentTarget.value })} placeholder="简单描述画面" /></label></div>
                          </div>
                        ) : block.type === "link" ? (
                          <div className="archive-link-block-editor"><input value={block.text} onChange={(event) => updateBlock(block.id, { text: event.currentTarget.value })} placeholder="按钮文字，例如：打开海报工具" /><input type="url" value={block.href} onChange={(event) => updateBlock(block.id, { href: event.currentTarget.value })} placeholder="https://…" /></div>
                        ) : (
                          <div className="archive-text-block-editor"><textarea rows={block.type === "paragraph" ? 7 : 3} value={block.text} onChange={(event) => updateBlock(block.id, { text: event.currentTarget.value })} placeholder={block.type === "heading" ? "输入小标题" : block.type === "quote" ? "输入引语" : "输入正文；换行会被保留"} /><label><span>对齐</span><select value={block.align ?? "left"} onChange={(event) => updateBlock(block.id, { align: event.currentTarget.value as "left" | "center" | "right" })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label></div>
                        )}
                      </article>
                    ))}
                  </div>
                </article>
              </div>
            </section>

            <aside className="archive-preview-panel">
              <header><div><span>PREVIEW</span><strong>手机预览</strong></div><i aria-hidden="true" /></header>
              <div className="archive-phone-frame"><div className="archive-phone-speaker" /><div className="archive-phone-screen"><span className="archive-phone-route">ISSUE {activeFilm.issue} / {archiveSectionLabels[activeSection].zh}</span><h3>{title || "内容标题会出现在这里"}</h3>{previewBlocks.length ? <ArchiveLayout blocks={previewBlocks} /> : <p>插入内容以后，这里会实时显示手机端阅读效果。</p>}</div></div>
              <div className="archive-publish-box"><div><span>发布位置</span><strong>{activeFilm.title} · {archiveSectionLabels[activeSection].zh}</strong></div><button className="archive-publish-layout" type="submit">{publishing ? "正在上传并发布…" : "发布内容"}</button><p className="archive-publish-message">{publishMessage || "图片会上传到腾讯云，当前排版顺序会原样保存。"}</p></div>
            </aside>
          </div>
        </fieldset>
      </form>
    </main>
  );
}
