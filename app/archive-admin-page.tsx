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

  return (
    <main className="archive-page archive-admin-page">
      <header className="archive-header">
        <a href="/archive/" className="archive-back-link">← 返回往期活动</a>
        <div className="archive-header-title"><span>CONTENT DESK</span><strong>内容后台</strong></div>
        <a href="/" className="archive-login-link">宇宙放映 ↗</a>
      </header>

      <section className="archive-admin-shell">
        <div className="archive-admin-intro">
          <span>FOR COSMOS FILMS EDITORS</span>
          <h1>不是上传表单，<br />是排版工作台。</h1>
          <p>把文字和图片像剪辑一样排起来。文章、工具和周边各自成页，图片直接拖进画布，发布后保持这里看到的顺序。</p>
        </div>

        {!editor ? (
          <form className="archive-login-form" onSubmit={handleLogin}>
            <div className="archive-form-heading"><span>01 / SIGN IN</span><h2>编辑登录</h2></div>
            {needsSecureHost && hostedAdminUrl ? <a className="archive-admin-safe-link" href={hostedAdminUrl}>进入腾讯云安全后台 ↗</a> : null}
            <label><span>账号</span><input name="username" autoComplete="username" required placeholder="编辑账号" /></label>
            <label><span>密码</span><input name="password" type="password" autoComplete="current-password" required placeholder="••••••••" /></label>
            <button type="submit" disabled={!configured || loginState === "loading"}>{loginState === "loading" ? "验证中…" : "登录内容后台"}</button>
            <p className={loginState === "error" ? "is-error" : ""}>{message}</p>
          </form>
        ) : (
          <section className="archive-login-form archive-session-card">
            <div className="archive-form-heading"><span>01 / SIGNED IN</span><h2>{editor.username}</h2></div>
            <strong className="archive-role-badge">{editor.role === "admin" ? "最高权限" : "仅上传图片"}</strong>
            <p>{message}</p>
            <button type="button" onClick={handleSignOut}>退出登录</button>
          </section>
        )}

        <section className="archive-layout-studio" aria-labelledby="layout-studio-title">
          <div className="archive-form-heading archive-studio-heading">
            <div><span>02 / COMPOSE</span><h2 id="layout-studio-title">排版工作台</h2></div>
            <p>{sectionHints[editor?.role === "photo-uploader" ? "photos" : section]}</p>
          </div>

          <form onSubmit={handlePublish}>
            <fieldset disabled={!editor || publishing}>
              <div className="archive-studio-settings">
                <label><span>对应电影</span><select value={film} onChange={(event) => setFilm(event.currentTarget.value as typeof film)}>{archiveFilms.map((item) => <option key={item.slug} value={item.slug}>ISSUE {item.issue} · {item.title}</option>)}</select></label>
                <label><span>内容分页</span><select value={editor?.role === "photo-uploader" ? "photos" : section} disabled={editor?.role === "photo-uploader"} onChange={(event) => setSection(event.currentTarget.value as ArchiveSection)}>{(Object.keys(archiveSectionLabels) as ArchiveSection[]).map((key) => <option key={key} value={key}>{archiveSectionLabels[key].zh}</option>)}</select></label>
                <label className="archive-title-field"><span>内容标题</span><input value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder={section === "merch" ? "例如：Death List Five 印刷物" : "输入这篇内容的标题"} /></label>
              </div>

              <div className="archive-block-toolbar" aria-label="添加内容块">
                {canComposeText ? <>
                  <button type="button" onClick={() => addTextBlock("heading")}>＋ 小标题</button>
                  <button type="button" onClick={() => addTextBlock("paragraph")}>＋ 正文</button>
                  <button type="button" onClick={() => addTextBlock("quote")}>＋ 引语</button>
                  <button type="button" onClick={addLinkBlock}>＋ 按钮</button>
                </> : null}
                <label className="archive-image-picker"><span>＋ 图片</span><input type="file" accept="image/*" multiple onChange={handleImageInput} /></label>
              </div>

              <div className="archive-studio-columns">
                <div className={`archive-block-canvas${isDroppingFiles ? " is-dropping" : ""}`} onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setIsDroppingFiles(true); }} onDragLeave={() => setIsDroppingFiles(false)} onDrop={handleWorkspaceDrop}>
                  {!blocks.length ? (
                    <div className="archive-empty-canvas"><strong>把图片拖到这里</strong><span>或用上面的按钮加入文字、引语和链接</span></div>
                  ) : blocks.map((block, index) => (
                    <article className="archive-editor-block" draggable key={block.id} onDragStart={() => setDraggedBlockId(block.id)} onDragEnd={() => setDraggedBlockId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleBlockDrop(event, block.id)}>
                      <header>
                        <span className="archive-drag-handle">⠿ {String(index + 1).padStart(2, "0")} · {block.type.toUpperCase()}</span>
                        <div>
                          <button type="button" aria-label="上移" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}>↑</button>
                          <button type="button" aria-label="下移" disabled={index === blocks.length - 1} onClick={() => moveBlock(block.id, 1)}>↓</button>
                          <button type="button" aria-label="删除" onClick={() => removeBlock(block.id)}>×</button>
                        </div>
                      </header>

                      {block.type === "image" ? (
                        <div className="archive-image-block-editor">
                          {block.preview ? <img src={block.preview} alt="上传预览" /> : null}
                          <div>
                            <label><span>图片宽度</span><select value={block.size ?? "full"} onChange={(event) => updateBlock(block.id, { size: event.currentTarget.value as "full" | "wide" | "half" })}><option value="full">通栏</option><option value="wide">宽版</option><option value="half">半版</option></select></label>
                            <label><span>图片说明</span><input value={block.caption ?? ""} onChange={(event) => updateBlock(block.id, { caption: event.currentTarget.value })} placeholder="显示在图片下面" /></label>
                            <label><span>替代文字</span><input value={block.alt ?? ""} onChange={(event) => updateBlock(block.id, { alt: event.currentTarget.value })} placeholder="简单描述画面" /></label>
                          </div>
                        </div>
                      ) : block.type === "link" ? (
                        <div className="archive-link-block-editor">
                          <input value={block.text} onChange={(event) => updateBlock(block.id, { text: event.currentTarget.value })} placeholder="按钮文字，例如：打开海报工具" />
                          <input type="url" value={block.href} onChange={(event) => updateBlock(block.id, { href: event.currentTarget.value })} placeholder="https://…" />
                        </div>
                      ) : (
                        <div className="archive-text-block-editor">
                          <textarea rows={block.type === "paragraph" ? 7 : 3} value={block.text} onChange={(event) => updateBlock(block.id, { text: event.currentTarget.value })} placeholder={block.type === "heading" ? "输入小标题" : block.type === "quote" ? "输入引语" : "输入正文；换行会被保留"} />
                          <label><span>对齐</span><select value={block.align ?? "left"} onChange={(event) => updateBlock(block.id, { align: event.currentTarget.value as "left" | "center" | "right" })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label>
                        </div>
                      )}
                    </article>
                  ))}
                </div>

                <aside className="archive-live-layout-preview">
                  <span>LIVE PREVIEW</span>
                  <h3>{title || "内容标题会出现在这里"}</h3>
                  {previewBlocks.length ? <ArchiveLayout blocks={previewBlocks} /> : <p>加入内容块以后，这里会实时显示发布效果。</p>}
                </aside>
              </div>

              <button className="archive-publish-layout" type="submit">{publishing ? "正在上传并发布…" : `发布到「${archiveSectionLabels[editor?.role === "photo-uploader" ? "photos" : section].zh}」`}</button>
            </fieldset>
          </form>
          <p className="archive-publish-message">{editor ? (publishMessage || "图片会传到腾讯云，排版顺序保存到对应电影分页。") : "登录后排版工作台会自动解锁。"}</p>
        </section>
      </section>
    </main>
  );
}
