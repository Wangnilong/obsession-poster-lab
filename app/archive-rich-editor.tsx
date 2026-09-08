"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import DOMPurify from "dompurify";
import { uploadArchiveImage } from "./cloudbase-archive";
import articleFormat from "../cloudfunctions/archive-api/article-format.json";

const allowedStyles = Object.fromEntries(Object.entries(articleFormat.styles).map(([name, pattern]) => [name, new RegExp(pattern, "i")]));
type Caret = { start: number[]; end: number[]; startOffset: number; endOffset: number };

export function cleanEditorHtml(html: string) {
  const fragment = DOMPurify.sanitize(html, { ALLOWED_TAGS: articleFormat.tags, ALLOWED_ATTR: ["style", "href", "title", "src", "alt", "data-file-id", "width", "color", "face", "size", "colspan", "rowspan"], ALLOW_DATA_ATTR: false, RETURN_DOM_FRAGMENT: true });
  fragment.querySelectorAll<HTMLElement>("[style]").forEach(element => {
    for (const property of Array.from(element.style)) {
      if (!allowedStyles[property]?.test(element.style.getPropertyValue(property))) element.style.removeProperty(property);
      else element.style.setProperty(property, element.style.getPropertyValue(property));
    }
  });
  const container = document.createElement("div"); container.appendChild(fragment);
  return container.innerHTML;
}

export default function ArchiveRichEditor({ initialHtml, film, disabled = false, onChange, onBusy, onMessage, children }: {
  initialHtml: string; film: string; disabled?: boolean; onChange: (html: string) => void; onBusy: (busy: boolean) => void; onMessage: (message: string) => void; children?: ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [tab, setTab] = useState("开始");
  const [zoom, setZoom] = useState(100);
  const [format, setFormat] = useState({ bold: false, italic: false, underline: false, block: "p", font: "Arial", size: "12", line: "1.9" });
  const history = useRef<{ html: string; caret?: Caret }[]>([]);
  const historyIndex = useRef(0);
  const locked = disabled || uploading;
  useEffect(() => {
    if (surface.current) {
      surface.current.innerHTML = cleanEditorHtml(initialHtml);
      history.current = [{ html: surface.current.innerHTML }];
    }
    // The parent keys this document by record id. Typing must never reset the caret.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const caret = (): Caret | undefined => {
    const range = selection.current;
    if (!range || !surface.current?.contains(range.startContainer) || !surface.current.contains(range.endContainer)) return;
    const path = (node: Node) => {
      const indices: number[] = [];
      while (node !== surface.current && node.parentNode) { indices.unshift(Array.prototype.indexOf.call(node.parentNode.childNodes, node)); node = node.parentNode; }
      return indices;
    };
    return { start: path(range.startContainer), end: path(range.endContainer), startOffset: range.startOffset, endOffset: range.endOffset };
  };
  const remember = () => {
    const current = window.getSelection();
    if (current?.rangeCount && surface.current?.contains(current.anchorNode) && surface.current?.contains(current.focusNode)) {
      selection.current = current.getRangeAt(0).cloneRange();
      if (history.current[historyIndex.current]) history.current[historyIndex.current].caret = caret();
      const element = current.anchorNode instanceof Element ? current.anchorNode : current.anchorNode?.parentElement;
      const style = element ? getComputedStyle(element) : null;
      setFormat({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), underline: document.queryCommandState("underline"),
        block: element?.closest("p,h1,h2,h3,blockquote")?.tagName.toLowerCase() || "p", font: style?.fontFamily.split(",")[0].replace(/["']/g, "") || "Arial",
        size: style ? String(Math.round(parseFloat(style.fontSize) * .75 * 10) / 10) : "12", line: style ? String(Math.round(parseFloat(style.lineHeight) / parseFloat(style.fontSize) * 10) / 10) : "1.9" });
    }
  };
  const restore = () => {
    surface.current?.focus();
    const current = window.getSelection();
    if (selection.current && surface.current?.contains(selection.current.startContainer)) {
      current?.removeAllRanges(); current?.addRange(selection.current);
    }
  };
  const emit = () => {
    if (surface.current) {
      const html = cleanEditorHtml(surface.current.innerHTML);
      if (history.current[historyIndex.current]?.html !== html) {
        history.current = [...history.current.slice(0, historyIndex.current + 1), { html }].slice(-100);
        historyIndex.current = history.current.length - 1;
      }
      onChange(html);
    }
    remember();
  };
  const undo = (direction: number) => {
    if (locked || !surface.current) return;
    const next = historyIndex.current + direction;
    if (next < 0 || next >= history.current.length) return;
    const snapshot = history.current[next];
    historyIndex.current = next; surface.current.innerHTML = snapshot.html;
    selection.current = null; setSelectedImage(null);
    const range = document.createRange(); range.selectNodeContents(surface.current); range.collapse(false);
    if (snapshot.caret) {
      const resolve = (path: number[]) => path.reduce<Node | undefined>((node, index) => node?.childNodes[index], surface.current!);
      const start = resolve(snapshot.caret.start), end = resolve(snapshot.caret.end);
      if (start && end) {
        range.setStart(start, Math.min(snapshot.caret.startOffset, start.nodeType === Node.TEXT_NODE ? start.textContent!.length : start.childNodes.length));
        range.setEnd(end, Math.min(snapshot.caret.endOffset, end.nodeType === Node.TEXT_NODE ? end.textContent!.length : end.childNodes.length));
      }
    }
    selection.current = range; restore(); onChange(snapshot.html); remember();
  };
  const command = (name: string, value?: string) => { if (disabled) return; restore(); document.execCommand(name, false, value); emit(); };
  const paragraphStyle = (property: string, value: string) => {
    if (locked) return;
    restore();
    const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
    if (!range || !surface.current) return;
    let blocks = Array.from(surface.current.querySelectorAll<HTMLElement>("p,h1,h2,h3,h4,blockquote,li,td,th,div")).filter(element => {
      if (element.querySelector("p,h1,h2,h3,h4,li,div")) return false;
      return range.collapsed ? element.contains(range.startContainer) : range.intersectsNode(element);
    });
    if (!blocks.length) {
      document.execCommand("formatBlock", false, "p");
      const anchor = window.getSelection()?.anchorNode;
      const block = (anchor instanceof Element ? anchor : anchor?.parentElement)?.closest<HTMLElement>("p");
      if (block && surface.current.contains(block)) blocks = [block];
    }
    blocks.forEach(block => block.style.setProperty(property, value)); emit();
  };
  const fontSize = (value: string) => {
    if (locked) return;
    restore(); document.execCommand("fontSize", false, "7");
    surface.current?.querySelectorAll<HTMLElement>('font[size="7"]').forEach(element => { element.removeAttribute("size"); element.style.fontSize = `${value}pt`; });
    emit();
  };
  const imageStyle = (property: string, value: string) => {
    if (locked || !selectedImage || !surface.current?.contains(selectedImage)) return;
    selectedImage.style.setProperty(property, value); emit();
  };
  const centerImage = () => {
    if (locked || !selectedImage || !surface.current?.contains(selectedImage)) return;
    const parent = selectedImage.parentElement;
    if (parent && parent !== surface.current) { parent.style.setProperty("text-align", "center"); emit(); }
  };
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
  return <div className="cms-writing-area cms-word-editor">
    <div className="cms-word-controls">
      <div className="cms-word-tabs" role="tablist" aria-label="编辑功能">{["开始", "插入", "段落"].map(name => <button key={name} type="button" role="tab" id={`word-tab-${name}`} aria-controls={`word-panel-${name}`} aria-selected={tab === name} onClick={() => setTab(name)}>{name}</button>)}<span>图文编辑</span></div>
      <fieldset disabled={locked} className="cms-ribbon" role="tabpanel" id={`word-panel-${tab}`} aria-labelledby={`word-tab-${tab}`} onMouseDown={event => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>
        <div className="cms-ribbon-group"><div className="cms-ribbon-row"><button type="button" title="撤销 Ctrl+Z" onClick={() => undo(-1)}>↶ 撤销</button><button type="button" title="重做 Ctrl+Y" onClick={() => undo(1)}>↷ 重做</button></div><small>编辑</small></div>
        {tab === "开始" && <>
          <div className="cms-ribbon-group"><div className="cms-ribbon-row"><select aria-label="字体" value={format.font} onFocus={remember} onChange={event => command("fontName", event.target.value)}>{!["Arial", "SimSun", "KaiTi", "Microsoft YaHei", "Georgia"].includes(format.font) && <option value={format.font}>{format.font}</option>}<option value="Arial">Arial</option><option value="SimSun">宋体</option><option value="KaiTi">楷体</option><option value="Microsoft YaHei">微软雅黑</option><option value="Georgia">Georgia</option></select><select aria-label="字号（磅）" value={format.size} onFocus={remember} onChange={event => fontSize(event.target.value)}>{!["10", "12", "14", "16", "18", "24", "28", "36"].includes(format.size) && <option value={format.size}>{format.size} 磅</option>}{[10, 12, 14, 16, 18, 24, 28, 36].map(size => <option key={size} value={size}>{size} 磅</option>)}</select></div>
            <div className="cms-ribbon-row"><button type="button" title="加粗 Ctrl+B" aria-pressed={format.bold} onClick={() => command("bold")}><b>B</b></button><button type="button" title="斜体 Ctrl+I" aria-pressed={format.italic} onClick={() => command("italic")}><i>I</i></button><button type="button" title="下划线 Ctrl+U" aria-pressed={format.underline} onClick={() => command("underline")}><u>U</u></button><label className="cms-color" title="文字颜色">A<input aria-label="文字颜色" type="color" defaultValue="#333333" onFocus={remember} onChange={event => command("foreColor", event.target.value)} /></label><label className="cms-color cms-highlight" title="文字高亮">笔<input aria-label="文字高亮" type="color" defaultValue="#fff09b" onFocus={remember} onChange={event => command("hiliteColor", event.target.value)} /></label><button type="button" onClick={() => command("removeFormat")}>清除格式</button></div><small>字体</small></div>
          <div className="cms-ribbon-group"><div className="cms-ribbon-row"><select aria-label="段落样式" value={format.block} onFocus={remember} onChange={event => command("formatBlock", event.target.value)}><option value="p">正文</option><option value="h1">标题</option><option value="h2">标题 1</option><option value="h3">标题 2</option><option value="blockquote">引用</option></select></div><div className="cms-ribbon-row"><button type="button" onClick={() => command("insertUnorderedList")}>• 列表</button><button type="button" onClick={() => command("insertOrderedList")}>1. 编号</button></div><small>样式</small></div>
        </>}
        {(tab === "开始" || tab === "段落") && <div className="cms-ribbon-group"><div className="cms-ribbon-row">{[["justifyLeft", "左对齐"], ["justifyCenter", "居中"], ["justifyRight", "右对齐"], ["justifyFull", "两端对齐"]].map(([cmd, label]) => <button type="button" key={cmd} onClick={() => command(cmd)}>{label}</button>)}</div><div className="cms-ribbon-row"><select aria-label="行距" value={format.line} onFocus={remember} onChange={event => paragraphStyle("line-height", event.target.value)}>{!["1", "1.5", "1.9", "2", "2.5", "3"].includes(format.line) && <option value={format.line}>{format.line} 倍行距</option>}{[1, 1.5, 1.9, 2, 2.5, 3].map(line => <option key={line} value={line}>{line} 倍行距</option>)}</select><button type="button" onClick={() => paragraphStyle("text-indent", "2em")}>首行缩进</button><button type="button" onClick={() => paragraphStyle("text-indent", "0em")}>取消缩进</button></div><small>段落</small></div>}
        {tab === "段落" && <div className="cms-ribbon-group"><div className="cms-ribbon-row"><button type="button" onClick={() => paragraphStyle("margin-bottom", "0em")}>无段后间距</button><button type="button" onClick={() => paragraphStyle("margin-bottom", "1em")}>段后空一行</button></div><small>间距</small></div>}
        {tab === "插入" && <div className="cms-ribbon-group"><div className="cms-ribbon-row"><button type="button" onClick={() => { remember(); picker.current?.click(); }}>▧ 图片</button><button type="button" onClick={() => { remember(); setLinkOpen(!linkOpen); }}>链接</button><button type="button" onClick={() => command("insertHTML", '<table><tbody><tr><td><p>内容</p></td><td><p>内容</p></td></tr><tr><td><p><br></p></td><td><p><br></p></td></tr></tbody></table><p><br></p>')}>2 × 2 表格</button><button type="button" onClick={() => command("insertHorizontalRule")}>分隔线</button></div><small>插入到光标位置</small></div>}
      </fieldset>
    {linkOpen && <fieldset disabled={locked} className="cms-inline-tools"><input aria-label="链接地址" type="url" placeholder="https://…" value={linkUrl} onChange={event => setLinkUrl(event.target.value)} /><button type="button" onClick={() => { if (!/^https?:\/\//i.test(linkUrl)) { onMessage("链接需要以 https:// 或 http:// 开头"); return; } command("createLink", linkUrl); setLinkOpen(false); }}>插入链接</button><button type="button" onClick={() => setLinkOpen(false)}>取消</button></fieldset>}
    {selectedImage && <fieldset disabled={locked} className="cms-inline-tools"><span>图片宽度</span>{[50, 75, 100].map(width => <button type="button" key={width} onClick={() => imageStyle("width", `${width}%`)}>{width}%</button>)}<button type="button" onClick={centerImage}>图片居中</button><button type="button" onClick={() => { selectedImage.remove(); setSelectedImage(null); emit(); }}>移除图片</button></fieldset>}
    </div>
    <input hidden ref={picker} type="file" accept="image/*" multiple onChange={event => { void insertFiles(Array.from(event.target.files || [])); event.target.value = ""; }} />
    <div className="cms-paper-workspace"><div className="cms-word-ruler" aria-hidden="true">{Array.from({ length: 17 }, (_, index) => <span key={index}>{index || ""}</span>)}</div><div className="cms-word-paper" style={{ zoom: zoom / 100 }}>{children}
    <div ref={surface} className="cms-editable archive-rich-content" contentEditable={!uploading && !disabled} suppressContentEditableWarning role="textbox" aria-label="文章正文" aria-multiline="true" data-placeholder="在这里直接写正文，也可以从 Word 复制内容，或拖入图片…" onInput={event => { if (!(event.nativeEvent as InputEvent).isComposing) emit(); }} onCompositionEnd={emit} onKeyUp={remember} onMouseUp={remember} onBlur={remember} onClick={event => setSelectedImage(event.target instanceof HTMLImageElement ? event.target : null)}
      onKeyDown={event => { if (!event.nativeEvent.isComposing && (event.ctrlKey || event.metaKey) && ["z", "y"].includes(event.key.toLowerCase())) { event.preventDefault(); undo(event.key.toLowerCase() === "y" || event.shiftKey ? 1 : -1); } }}
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
      }} /></div></div>
    <div className="cms-word-view"><span>A4 稿纸 · 网页连续排版</span><label>显示比例 <select aria-label="显示比例" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[75, 90, 100, 110, 125].map(value => <option key={value} value={value}>{value}%</option>)}</select></label></div>
  </div>;
}
