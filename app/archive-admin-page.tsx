"use client";

/* eslint-disable @next/next/no-html-link-for-pages -- shared static EdgeOne/Vite routes */
/* eslint-disable @next/next/no-img-element -- local previews use object URLs */

import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { archiveFilms, archiveSectionLabels, type ArchiveLayoutBlock, type ArchiveSection } from "./archive-data";
import ArchiveLayout from "./archive-layout";
import CardCreationsAdmin from "./card-creations-admin";
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
type ArchiveDraft = { title: string; blocks: ArchivePublishBlock[] };
type BlockUpdate = {
  text?: string;
  href?: string;
  align?: "left" | "center" | "right";
  alt?: string;
  caption?: string;
  size?: "full" | "wide" | "half";
};

const emptyArchiveDraft: ArchiveDraft = { title: "", blocks: [] };

const builtInTools: Record<string, { title: string; eyebrow: string; copy: string; href: string }[]> = {
  obsession: [{ title: "Obsession 海报暗房", eyebrow: "CAMERA · POSTER", copy: "拍照、套用电影色调并导出可以打印的海报。", href: "/obsession/" }],
  "kill-bill": [
    { title: "暗杀名单生成器", eyebrow: "DEATH LIST FIVE", copy: "替换第五个名字并导出暗杀名单。", href: "/kill-bill/#death-list" },
    { title: "Killer License", eyebrow: "ID CARD", copy: "上传照片和名字，制作杀手身份卡。", href: "/kill-bill/#id-card" },
  ],
};

const sectionHints: Record<ArchiveSection, string> = {
  articles: "用标题、正文、引语和图片搭出文章，拖动内容块决定阅读顺序。",
  photos: "把映后照片直接拖进来，发布后进入独立图片墙。",
  tools: "现成的图片生成器会直接出现在这里，不需要编辑上传。",
  merch: "这里只上传周边实物图，发布后进入独立图片墙。",
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
  const [drafts, setDrafts] = useState<Record<string, ArchiveDraft>>({});
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [isDroppingFiles, setIsDroppingFiles] = useState(false);
  const [adminView, setAdminView] = useState<"content" | "community">("content");

  const activeSection: ArchiveSection = editor?.role === "photo-uploader" ? "photos" : section;
  const activeFilm = archiveFilms.find((item) => item.slug === film) ?? archiveFilms[0];
  const draftKey = `${film}:${activeSection}`;
  const currentDraft = drafts[draftKey] ?? emptyArchiveDraft;
  const { title, blocks } = currentDraft;
  const setTitle = (nextTitle: string) => setDrafts((current) => ({ ...current, [draftKey]: { ...(current[draftKey] ?? emptyArchiveDraft), title: nextTitle } }));
  const setBlocks = (update: ArchivePublishBlock[] | ((current: ArchivePublishBlock[]) => ArchivePublishBlock[])) => {
    setDrafts((current) => {
      const draft = current[draftKey] ?? emptyArchiveDraft;
      const nextBlocks = typeof update === "function" ? update(draft.blocks) : update;
      return { ...current, [draftKey]: { ...draft, blocks: nextBlocks } };
    });
  };

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
    setDrafts((current) => ({ ...current, [draftKey]: emptyArchiveDraft }));
  };

  const handlePublish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    const targetSection = activeSection;
    if (targetSection === "tools") return;
    const imageOnly = targetSection === "photos" || targetSection === "merch";
    if (!imageOnly && !title.trim()) {
      setPublishMessage("先写一个内容标题。");
      return;
    }
    if (!blocks.length) {
      setPublishMessage("画布还是空的，请先加入文字或图片。");
      return;
    }
    if (imageOnly && !blocks.some((block) => block.type === "image")) {
      setPublishMessage(`${archiveSectionLabels[targetSection].zh}至少需要一张图片。`);
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
        title: title.trim() || `${activeFilm.title} · ${archiveSectionLabels[targetSection].zh} · ${new Date().toLocaleDateString("zh-CN")}`,
        blocks: imageOnly ? blocks.filter((block) => block.type === "image") : blocks,
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

  const isImageLibrary = activeSection === "photos" || activeSection === "merch";
  const tools = builtInTools[film] ?? [];

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
        <div className="archive-workspace-crumb"><span>往期活动</span><b>/</b><strong>{adminView === "community" ? "KILL BILL · 用户作品" : `ISSUE ${activeFilm.issue} · ${activeFilm.title}`}</strong><b>/</b><span>{adminView === "community" ? "自动统计" : archiveSectionLabels[activeSection].zh}</span></div>
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
                  {archiveFilms.map((item) => <button type="button" className={adminView === "content" && film === item.slug ? "is-active" : ""} key={item.slug} onClick={() => { setFilm(item.slug); setAdminView("content"); }}><span>{item.issue}</span><span><strong>{item.title}</strong><small>ISSUE {item.issue}</small></span></button>)}
                </div>
              </section>
              <section>
                <h2>内容分页</h2>
                <div className="archive-section-nav">
                  {(Object.keys(archiveSectionLabels) as ArchiveSection[]).map((key, index) => {
                    const locked = editor.role === "photo-uploader" && key !== "photos";
                    return <button type="button" className={adminView === "content" && activeSection === key ? "is-active" : ""} key={key} disabled={locked} onClick={() => { setSection(key); setAdminView("content"); }}><span>{String(index + 1).padStart(2, "0")}</span><strong>{archiveSectionLabels[key].zh}</strong></button>;
                  })}
                </div>
              </section>
              {editor.role === "admin" ? <section className="archive-community-nav"><h2>自动收集</h2><button type="button" className={adminView === "community" ? "is-active" : ""} onClick={() => setAdminView("community")}><span>05</span><strong>用户作品 <b>LIVE</b></strong></button></section> : null}
              <p className="archive-nav-hint">{adminView === "community" ? "自动查看全部身份小卡，下载完整图片包，并管理作品墙显示状态。" : sectionHints[activeSection]}</p>
            </aside>

            {adminView === "community" ? <CardCreationsAdmin role={editor.role} /> : <><section className="archive-word-editor" aria-labelledby="layout-studio-title">
              {activeSection === "articles" ? <>
                <header className="archive-word-ribbon">
                  <div className="archive-ribbon-tabs"><strong id="layout-studio-title">开始</strong><span>插入</span><span>布局</span></div>
                  <div className="archive-ribbon-tools" aria-label="添加文章内容">
                    <div className="archive-ribbon-group"><span>文字</span><div><button type="button" onClick={() => addTextBlock("heading")}><b>T</b>小标题</button><button type="button" onClick={() => addTextBlock("paragraph")}><b>¶</b>正文</button><button type="button" onClick={() => addTextBlock("quote")}><b>“</b>引语</button></div></div>
                    <div className="archive-ribbon-group"><span>插入</span><div><button type="button" onClick={addLinkBlock}><b>↗</b>按钮</button><label className="archive-ribbon-image"><b>▧</b>图片<input type="file" accept="image/*" multiple onChange={handleImageInput} /></label></div></div>
                    <div className="archive-ribbon-group archive-ribbon-meta"><span>当前页面</span><div><b>ISSUE {activeFilm.issue}</b><strong>文章</strong></div></div>
                  </div>
                </header>
                <div className="archive-document-desk">
                  <div className="archive-document-status"><span>{blocks.length} 个内容块</span><span>文章编辑模式</span></div>
                  <article className="archive-document-page">
                    <div className="archive-document-kicker"><span>COSMOS FILMS</span><span>ISSUE {activeFilm.issue} / READING</span></div>
                    <label className="archive-document-title"><span>文章标题</span><textarea rows={2} value={title} onChange={(event) => setTitle(event.currentTarget.value)} placeholder="输入这篇文章的标题" /></label>
                    <div className={`archive-block-canvas archive-document-canvas${isDroppingFiles ? " is-dropping" : ""}`} onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setIsDroppingFiles(true); }} onDragLeave={() => setIsDroppingFiles(false)} onDrop={handleWorkspaceDrop}>
                      {!blocks.length ? <div className="archive-empty-canvas"><strong>开始写文章</strong><span>从上方插入正文、标题、引语、图片或按钮</span></div> : blocks.map((block, index) => (
                        <article className="archive-editor-block" draggable key={block.id} onDragStart={() => setDraggedBlockId(block.id)} onDragEnd={() => setDraggedBlockId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleBlockDrop(event, block.id)}>
                          <header><span className="archive-drag-handle">⠿ {String(index + 1).padStart(2, "0")} · {block.type.toUpperCase()}</span><div><button type="button" aria-label="上移" disabled={index === 0} onClick={() => moveBlock(block.id, -1)}>↑</button><button type="button" aria-label="下移" disabled={index === blocks.length - 1} onClick={() => moveBlock(block.id, 1)}>↓</button><button type="button" aria-label="删除" onClick={() => removeBlock(block.id)}>×</button></div></header>
                          {block.type === "image" ? <div className="archive-image-block-editor">{block.preview ? <img src={block.preview} alt="上传预览" /> : null}<div><label><span>图片宽度</span><select value={block.size ?? "full"} onChange={(event) => updateBlock(block.id, { size: event.currentTarget.value as "full" | "wide" | "half" })}><option value="full">通栏</option><option value="wide">宽版</option><option value="half">半版</option></select></label><label><span>图片说明</span><input value={block.caption ?? ""} onChange={(event) => updateBlock(block.id, { caption: event.currentTarget.value })} placeholder="显示在图片下面" /></label><label><span>替代文字</span><input value={block.alt ?? ""} onChange={(event) => updateBlock(block.id, { alt: event.currentTarget.value })} placeholder="简单描述画面" /></label></div></div> : block.type === "link" ? <div className="archive-link-block-editor"><input value={block.text} onChange={(event) => updateBlock(block.id, { text: event.currentTarget.value })} placeholder="按钮文字" /><input type="url" value={block.href} onChange={(event) => updateBlock(block.id, { href: event.currentTarget.value })} placeholder="https://…" /></div> : <div className="archive-text-block-editor"><textarea rows={block.type === "paragraph" ? 7 : 3} value={block.text} onChange={(event) => updateBlock(block.id, { text: event.currentTarget.value })} placeholder={block.type === "heading" ? "输入小标题" : block.type === "quote" ? "输入引语" : "输入正文；换行会被保留"} /><label><span>对齐</span><select value={block.align ?? "left"} onChange={(event) => updateBlock(block.id, { align: event.currentTarget.value as "left" | "center" | "right" })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></label></div>}
                        </article>
                      ))}
                    </div>
                  </article>
                </div>
              </> : isImageLibrary ? <>
                <header className="archive-library-toolbar">
                  <div><span>ISSUE {activeFilm.issue}</span><h2 id="layout-studio-title">{activeSection === "photos" ? "上传映后图片" : "上传周边图片"}</h2><p>这里只收图片，不需要写文章，也不会和其他分页混在一起。</p></div>
                  <label className="archive-library-picker"><span>选择多张图片</span><input type="file" accept="image/*" multiple onChange={handleImageInput} /></label>
                </header>
                <div className="archive-media-desk">
                  <div className={`archive-media-uploader${isDroppingFiles ? " is-dropping" : ""}`} onDragOver={(event) => { event.preventDefault(); if (event.dataTransfer.types.includes("Files")) setIsDroppingFiles(true); }} onDragLeave={() => setIsDroppingFiles(false)} onDrop={handleWorkspaceDrop}>
                    {!blocks.length ? <div className="archive-media-empty"><b>＋</b><strong>把图片拖到这里</strong><span>支持一次选择多张，发布后直接进入图片墙</span></div> : <div className="archive-media-grid">{blocks.filter((block) => block.type === "image").map((block, index) => block.type === "image" ? <figure draggable key={block.id} onDragStart={() => setDraggedBlockId(block.id)} onDragEnd={() => setDraggedBlockId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => handleBlockDrop(event, block.id)}>{block.preview ? <img src={block.preview} alt={block.alt || "待上传图片"} /> : null}<figcaption><span>{String(index + 1).padStart(2, "0")} · {block.alt}</span><button type="button" onClick={() => removeBlock(block.id)}>删除</button></figcaption></figure> : null)}</div>}
                  </div>
                </div>
              </> : <div className="archive-tool-shelf">
                <header><span>ISSUE {activeFilm.issue} / BUILT-IN TOOLS</span><h2 id="layout-studio-title">现成工具</h2><p>这里直接放已经做好的图片生成器。它们随网站上线，不需要再上传文章或图片。</p></header>
                <div>{tools.map((tool, index) => <a href={tool.href} target="_blank" rel="noreferrer" key={tool.href}><span>{String(index + 1).padStart(2, "0")} · {tool.eyebrow}</span><h3>{tool.title}</h3><p>{tool.copy}</p><strong>打开生成器 ↗</strong></a>)}</div>
              </div>}
            </section>

            <aside className={`archive-preview-panel${activeSection === "tools" ? " archive-tool-preview" : ""}`}>
              <header><div><span>{activeSection === "tools" ? "LIVE TOOLS" : "PREVIEW"}</span><strong>{activeSection === "articles" ? "文章预览" : activeSection === "tools" ? "工具入口" : "图片墙预览"}</strong></div><i aria-hidden="true" /></header>
              {activeSection === "tools" ? <div className="archive-tool-preview-list">{tools.map((tool) => <a href={tool.href} target="_blank" rel="noreferrer" key={tool.href}><small>{tool.eyebrow}</small><strong>{tool.title}</strong><span>打开 ↗</span></a>)}</div> : <>
                <div className="archive-phone-frame"><div className="archive-phone-speaker" /><div className={`archive-phone-screen${isImageLibrary ? " is-gallery" : ""}`}><span className="archive-phone-route">ISSUE {activeFilm.issue} / {archiveSectionLabels[activeSection].zh}</span>{activeSection === "articles" ? <><h3>{title || "文章标题会出现在这里"}</h3>{previewBlocks.length ? <ArchiveLayout blocks={previewBlocks} /> : <p>写入内容以后，这里会实时显示手机端阅读效果。</p>}</> : previewBlocks.length ? <div className="archive-phone-gallery">{previewBlocks.filter((block) => block.type === "image").map((block, index) => block.type === "image" && block.image ? <img src={block.image} alt={block.alt || `图片 ${index + 1}`} key={`${block.image}-${index}`} /> : null)}</div> : <p>选择图片以后，这里会直接显示图片墙。</p>}</div></div>
                <div className="archive-publish-box"><div><span>发布位置</span><strong>{activeFilm.title} · {archiveSectionLabels[activeSection].zh}</strong></div><button className="archive-publish-layout" type="submit">{publishing ? "正在上传并发布…" : isImageLibrary ? `发布 ${blocks.length} 张图片` : "发布文章"}</button><p className="archive-publish-message">{publishMessage || (isImageLibrary ? "只上传图片，不生成文章排版。" : "文章排版会按当前顺序保存。")}</p></div>
              </>}
            </aside></>}
          </div>
        </fieldset>
      </form>
    </main>
  );
}
