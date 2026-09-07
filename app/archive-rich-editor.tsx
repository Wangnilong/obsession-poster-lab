"use client";

import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { uploadArchiveImage } from "./cloudbase-archive";

export function cleanEditorHtml(html: string) {
  return DOMPurify.sanitize(html, { ADD_ATTR: ["data-file-id"], FORBID_TAGS: ["style", "svg", "math", "iframe", "form", "input", "button"] });
}

export default function ArchiveRichEditor({ initialHtml, film, disabled = false, onChange, onBusy, onMessage }: {
  initialHtml: string; film: string; disabled?: boolean; onChange: (html: string) => void; onBusy: (busy: boolean) => void; onMessage: (message: string) => void;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  useEffect(() => {
    if (surface.current) surface.current.innerHTML = cleanEditorHtml(initialHtml);
    // The parent keys this document by record id. Typing must never reset the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const remember = () => {
    const current = window.getSelection();
    if (current?.rangeCount && surface.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange();
  };
  const restore = () => {
    surface.current?.focus();
    const current = window.getSelection();
    if (selection.current && surface.current?.contains(selection.current.startContainer)) {
      current?.removeAllRanges(); current?.addRange(selection.current);
    }
  };
  const emit = () => { if (surface.current) onChange(cleanEditorHtml(surface.current.innerHTML)); remember(); };
  const command = (name: string, value?: string) => { if (disabled) return; restore(); document.execCommand(name, false, value); emit(); };
  const insertFiles = async (files: File[]) => {
    if (disabled || uploading || !files.length) return;
    remember();
    setUploading(true); onBusy(true);
    try {
      let count = 0;
      for (const file of files) {
        onMessage(`正在插入图片 ${++count}/${files.length}…`);
        const image = await uploadArchiveImage(file, film, "articles");
        const element = document.createElement("img");
        element.src = image.url; element.dataset.fileId = image.fileID; element.alt = file.name;
        command("insertHTML", `<p>${element.outerHTML}</p><p><br></p>`);
      }
      onMessage("图片已插入，可以点击图片调整宽度，或剪切后粘贴到其他位置。");
    } catch (error) { onMessage(error instanceof Error ? error.message : "图片插入失败"); }
    finally { setUploading(false); onBusy(false); }
  };
  return <div className="cms-writing-area">
    <div className="cms-ribbon" role="toolbar" aria-label="正文排版" onMouseDown={event => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>
      <select aria-label="段落样式" defaultValue="p" onFocus={remember} onChange={event => command("formatBlock", event.target.value)}><option value="p">正文</option><option value="h2">大标题</option><option value="h3">小标题</option><option value="blockquote">引用</option></select>
      <select aria-label="字体" defaultValue="sans-serif" onFocus={remember} onChange={event => command("fontName", event.target.value)}><option value="sans-serif">默认字体</option><option value="SimSun, serif">宋体</option><option value="KaiTi, serif">楷体</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option></select>
      <select aria-label="字号" defaultValue="3" onFocus={remember} onChange={event => command("fontSize", event.target.value)}><option value="2">小</option><option value="3">标准</option><option value="4">大</option><option value="5">特大</option><option value="6">标题</option></select>
      <button type="button" title="加粗 Ctrl+B" onClick={() => command("bold")}><b>B</b></button><button type="button" title="斜体 Ctrl+I" onClick={() => command("italic")}><i>I</i></button><button type="button" title="下划线 Ctrl+U" onClick={() => command("underline")}><u>U</u></button>
      <label className="cms-color" title="文字颜色">A<input aria-label="文字颜色" type="color" defaultValue="#333333" onFocus={remember} onChange={event => command("foreColor", event.target.value)} /></label>
      <button type="button" title="左对齐" onClick={() => command("justifyLeft")}>左</button><button type="button" title="居中" onClick={() => command("justifyCenter")}>中</button><button type="button" title="右对齐" onClick={() => command("justifyRight")}>右</button>
      <button type="button" title="项目列表" onClick={() => command("insertUnorderedList")}>• 列表</button><button type="button" title="编号列表" onClick={() => command("insertOrderedList")}>1. 列表</button>
      <button type="button" onClick={() => { remember(); picker.current?.click(); }} disabled={uploading}>▧ 图片</button>
      <button type="button" onClick={() => { remember(); setLinkOpen(!linkOpen); }}>链接</button><button type="button" title="分隔线" onClick={() => command("insertHorizontalRule")}>―</button>
      <button type="button" title="撤销 Ctrl+Z" onClick={() => command("undo")}>↶</button><button type="button" title="重做 Ctrl+Y" onClick={() => command("redo")}>↷</button><button type="button" onClick={() => command("removeFormat")}>清除格式</button>
    </div>
    {linkOpen && <div className="cms-inline-tools"><input aria-label="链接地址" type="url" placeholder="https://…" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} /><button type="button" onClick={() => { if (!/^https?:\/\//i.test(linkUrl)) { onMessage("链接需要以 https:// 或 http:// 开头"); return; } command("createLink", linkUrl); setLinkOpen(false); }}>插入链接</button></div>}
    {selectedImage && <div className="cms-inline-tools"><span>图片宽度</span>{[50, 75, 100].map(width => <button type="button" key={width} onClick={() => { selectedImage.style.width = `${width}%`; emit(); }}>{width}%</button>)}<button type="button" onClick={() => { selectedImage.remove(); setSelectedImage(null); emit(); }}>移除图片</button></div>}
    <input hidden ref={picker} type="file" accept="image/*" multiple onChange={event => { void insertFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
    <div ref={surface} className="cms-editable archive-rich-content" contentEditable={!uploading && !disabled} suppressContentEditableWarning role="textbox" aria-label="文章正文" aria-multiline="true" data-placeholder="在这里直接写正文，也可以从 Word 复制内容，或拖入图片…" onInput={emit} onKeyUp={remember} onMouseUp={remember} onBlur={remember} onClick={event => setSelectedImage(event.target instanceof HTMLImageElement ? event.target : null)}
      onPaste={event => {
        const images = Array.from(event.clipboardData.files).filter(file => file.type.startsWith("image/"));
        if (images.length) { event.preventDefault(); void insertFiles(images); return; }
        const html = event.clipboardData.getData("text/html");
        if (html) { event.preventDefault(); command("insertHTML", cleanEditorHtml(html)); }
      }}
      onDragOver={event => { if (event.dataTransfer.types.includes("Files")) event.preventDefault(); }}
      onDrop={event => {
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        const caretDocument = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
        const range = caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY);
        if (range && surface.current?.contains(range.startContainer)) { window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range); remember(); }
        void insertFiles(Array.from(event.dataTransfer.files).filter(file => file.type.startsWith("image/")));
      }} />
  </div>;
}
