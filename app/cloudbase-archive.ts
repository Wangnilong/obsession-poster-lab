import type { ArchiveEntry, ArchiveLayoutBlock, ArchiveSection } from "./archive-data";
import { emptyPresentation, type ArchivePresentation } from "./archive-presentation";
import { eventFilm, type EventCatalog, type EventRecord } from "./archive-events";

type CloudBaseSdk = typeof import("@cloudbase/js-sdk");
type CloudBaseApp = ReturnType<CloudBaseSdk["init"]>;

export type ArchiveRole = "admin" | "photo-uploader";

export type AdminCardCreation = {
  id: string;
  cardType: "death-list" | "killer-license";
  displayName: string;
  image: string;
  createdAt: number;
  status: "published" | "hidden";
  visibility: "public" | "private";
};

type CloudBaseConfig = {
  env: string;
  region: string;
  publicApiUrl?: string;
  adminUrl?: string;
};

export type PublishedArchiveRecord = {
  _id?: string;
  film: string;
  section: ArchiveSection;
  title: string;
  meta: string;
  copy?: string;
  href?: string;
  action?: string;
  fileID?: string;
  imageAlt?: string;
  layout?: ArchiveLayoutBlock[];
  createdAt: number;
  createdBy: string;
  status: "published" | "draft" | "hidden";
  articleHtml?: string;
  updatedAt?: number;
  pendingHtml?: string;
  pendingTitle?: string;
  pendingCopy?: string;
};

export type ArchivePublishBlock =
  | {
      id: string;
      type: "heading" | "paragraph" | "quote";
      text: string;
      align?: "left" | "center" | "right";
    }
  | {
      id: string;
      type: "image";
      file?: File;
      preview?: string;
      alt?: string;
      caption?: string;
      size?: "full" | "wide" | "half";
    }
  | {
      id: string;
      type: "link";
      text: string;
      href: string;
    };

const archiveRoles: Record<string, ArchiveRole> = {
  huaishan: "admin",
  niuza: "admin",
  xiaoai: "admin",
  wangnilong: "admin",
  yuzhou: "photo-uploader",
};

let appPromise: Promise<CloudBaseApp> | null = null;

async function loadConfig() {
  const response = await fetch("/cloudbase-config.json", { cache: "no-store" });
  if (!response.ok) throw new Error("CloudBase 配置文件不可用");
  const config = await response.json() as CloudBaseConfig;
  if (!config.env) throw new Error("CloudBase 环境尚未创建");
  return config;
}

async function getArchiveApp() {
  if (!appPromise) {
    appPromise = Promise.all([loadConfig(), import("@cloudbase/js-sdk")]).then(([config, sdk]) => (
      sdk.default.init({
        env: config.env,
        region: config.region || "ap-shanghai",
      })
    ));
  }
  return appPromise;
}

export function roleForArchiveUser(username: string): ArchiveRole | null {
  return archiveRoles[username.trim().toLowerCase()] ?? null;
}

export async function isCloudBaseConfigured() {
  try {
    await getArchiveApp();
    return true;
  } catch {
    return false;
  }
}

export async function getArchiveAdminUrl() {
  const config = await loadConfig();
  return config.adminUrl ?? null;
}

export async function signInArchiveUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const role = roleForArchiveUser(normalizedUsername);
  if (!role) throw new Error("这个账号没有内容后台权限");

  const app = await getArchiveApp();
  await app.auth().signInWithUsernameAndPassword(normalizedUsername, password);
  return { username: normalizedUsername, role };
}

export async function signOutArchiveUser() {
  const app = await getArchiveApp();
  await app.auth().signOut();
}

function safeFileName(name: string) {
  const extension = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "")}` : "";
  return `${Date.now()}-${crypto.randomUUID()}${extension}`;
}

export async function publishArchiveContent(input: {
  username: string;
  role: ArchiveRole;
  film: string;
  section: ArchiveSection;
  title: string;
  copy?: string;
  href?: string;
  file?: File | null;
  blocks?: ArchivePublishBlock[];
}) {
  if (input.role === "photo-uploader" && input.section !== "photos") {
    throw new Error("这个账号只能上传映后图片");
  }
  const imageBlocks = input.blocks?.filter((block) => block.type === "image" && block.file) ?? [];
  if (input.section === "photos" && !input.file && !imageBlocks.length) {
    throw new Error("映后图片分页必须选择一张图片");
  }

  const app = await getArchiveApp();
  let fileID: string | undefined;
  if (input.file) {
    const result = await app.uploadFile({
      cloudPath: `archive/${input.film}/${input.section}/${safeFileName(input.file.name)}`,
      filePath: input.file as unknown as string,
    });
    fileID = result.fileID;
  }

  const layout: ArchiveLayoutBlock[] = [];
  for (const block of input.blocks ?? []) {
    if (block.type === "image") {
      if (!block.file) continue;
      const result = await app.uploadFile({
        cloudPath: `archive/${input.film}/${input.section}/${safeFileName(block.file.name)}`,
        filePath: block.file as unknown as string,
      });
      layout.push({
        type: "image",
        fileID: result.fileID,
        alt: block.alt?.trim() || input.title.trim(),
        caption: block.caption?.trim() || undefined,
        size: block.size ?? "full",
      });
      continue;
    }

    if (block.type === "link") {
      if (block.text.trim() && block.href.trim()) {
        layout.push({ type: "link", text: block.text.trim(), href: block.href.trim() });
      }
      continue;
    }

    if (block.text.trim()) {
      layout.push({ type: block.type, text: block.text.trim(), align: block.align ?? "left" });
    }
  }

  const record: PublishedArchiveRecord = {
    film: input.film,
    section: input.section,
    title: input.title.trim(),
    meta: `COSMOS FILMS · ${new Date().getFullYear()}`,
    copy: input.copy?.trim() || undefined,
    href: input.href?.trim() || undefined,
    action: input.href?.trim() ? "打开内容" : undefined,
    fileID,
    imageAlt: input.title.trim(),
    layout: layout.length ? layout : undefined,
    createdAt: Date.now(),
    createdBy: input.username,
    status: "published",
  };

  await app.database().collection("archive_content").add(record);
}

export async function loadArchiveContent(film: string, section: ArchiveSection): Promise<ArchiveEntry[]> {
  try {
    const config = await loadConfig();
    if (!config.publicApiUrl) return [];
    const endpoint = new URL(config.publicApiUrl);
    endpoint.searchParams.set("film", film);
    endpoint.searchParams.set("section", section);
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) return [];
    const payload = await response.json() as { entries?: ArchiveEntry[] };
    return payload.entries ?? [];
  } catch {
    return [];
  }
}

export async function uploadArchiveImage(file: File, film: string, section: ArchiveSection | "covers") {
  if (!file.type.startsWith("image/")) throw new Error("请选择图片文件");
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} 超过 20 MB，请压缩后再上传`);
  const app = await getArchiveApp();
  const result = await app.uploadFile({ cloudPath: `archive/${film}/${section}/${safeFileName(file.name)}`, filePath: file as unknown as string });
  const urls = await app.getTempFileURL({ fileList: [result.fileID] });
  const url = urls.fileList?.[0]?.tempFileURL;
  if (!url) throw new Error("图片链接获取失败，请重试");
  return { fileID: result.fileID, url };
}

export async function listEditorContent(film: string, section: ArchiveSection, role: ArchiveRole): Promise<PublishedArchiveRecord[]> {
  if (role !== "admin" && section !== "photos") throw new Error("此账号只允许查看映后图片");
  const app = await getArchiveApp();
  const records: PublishedArchiveRecord[] = [];
  for (let offset = 0; ; offset += 100) {
    const result = await editorRequest<{ records: PublishedArchiveRecord[] }>("editor-list", { film, section, offset });
    const page = result.records;
    records.push(...page);
    if (page.length < 100) break;
  }
  const ids = [...new Set(records.flatMap(record => [record.fileID, ...(record.layout || []).map(block => block.type === "image" ? block.fileID : undefined), ...Array.from(((record.articleHtml || "") + (record.pendingHtml || "")).matchAll(/data-file-id="([^"]+)"/g), match => match[1])]).filter((id): id is string => Boolean(id)))];
  const urls = new Map<string, string>();
  for (let start = 0; start < ids.length; start += 50) {
    const result = await app.getTempFileURL({ fileList: ids.slice(start, start + 50) });
    result.fileList?.forEach(file => { if (file.tempFileURL) urls.set(file.fileID, file.tempFileURL); });
  }
  return records.map(record => ({ ...record,
    layout: [ ...(record.fileID ? [{ type: "image" as const, fileID: record.fileID, image: urls.get(record.fileID), alt: record.imageAlt }] : []), ...(record.layout || []).map(block => block.type === "image" ? { ...block, image: block.fileID ? urls.get(block.fileID) : block.image } : block)],
    articleHtml: record.articleHtml?.replace(/<img\b[^>]*>/g, tag => { const id = /data-file-id="([^"]+)"/.exec(tag)?.[1]; return id && urls.has(id) ? tag.replace(/\ssrc="[^"]*"/, ` src="${urls.get(id)!.replace(/&/g, "&amp;")}"`) : tag; }),
    pendingHtml: record.pendingHtml?.replace(/<img\b[^>]*>/g, tag => { const id = /data-file-id="([^"]+)"/.exec(tag)?.[1]; return id && urls.has(id) ? tag.replace(/\ssrc="[^"]*"/, ` src="${urls.get(id)!.replace(/&/g, "&amp;")}"`) : tag; }),
  }));
}

async function editorRequest<T>(action: string, data: object): Promise<T> {
  const app = await getArchiveApp();
  const result = await app.callFunction({ name: "archive-api", data: { action, ...data }, parse: true });
  const payload = result.result as T & { ok?: boolean; message?: string };
  if (!payload?.ok) throw new Error(payload?.message || "操作失败，请重试");
  return payload;
}

export async function saveEditorContent(record: PublishedArchiveRecord, role: ArchiveRole) {
  if (role !== "admin" && (record.section !== "photos" || record._id)) throw new Error("此账号只允许上传映后图片");
  return (await editorRequest<{ id: string }>("editor-save", { record: JSON.parse(JSON.stringify(record)) })).id;
}

export async function hideEditorContent(id: string) {
  await editorRequest("editor-hide", { id });
}

export async function loadArchiveDocument(film: string, section: ArchiveSection) {
  const config = await loadConfig();
  if (!config.publicApiUrl) throw new Error("内容服务尚未连接");
  const endpoint = new URL(config.publicApiUrl);
  endpoint.searchParams.set("film", film); endpoint.searchParams.set("section", section);
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error("内容加载失败，请稍后重试");
  const result = await response.json() as { entries: ArchiveEntry[]; presentation?: ArchivePresentation };
  return { entries: result.entries, presentation: result.presentation || emptyPresentation() };
}

export async function loadArchivePresentations(): Promise<Record<string, ArchivePresentation>> {
  const config = await loadConfig();
  if (!config.publicApiUrl) return {};
  const endpoint = new URL(config.publicApiUrl); endpoint.searchParams.set("action", "presentations");
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error("海报加载失败");
  return ((await response.json()) as { presentations: Record<string, ArchivePresentation> }).presentations;
}

export async function getEditorPresentation(film: string) {
  return (await editorRequest<{ presentation: ArchivePresentation }>("presentation-get", { film })).presentation;
}

export async function loadArchiveEvents() {
  const config = await loadConfig();
  if (!config.publicApiUrl) throw new Error("活动服务尚未连接");
  const endpoint = new URL(config.publicApiUrl); endpoint.searchParams.set("action", "events");
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error("活动加载失败，请刷新重试");
  return ((await response.json()) as { events: EventRecord[] }).events.map(eventFilm);
}
export async function getEditorEvents() { return (await editorRequest<{ catalog: EventCatalog }>("events-get", {})).catalog; }
export async function saveEditorEvents(catalog: EventCatalog) { return (await editorRequest<{ catalog: EventCatalog }>("events-save", { catalog })).catalog; }
export async function loadEditorDocument(film: string, section: ArchiveSection) {
  return (await editorRequest<{ document: { entries: ArchiveEntry[]; presentation: ArchivePresentation } }>("event-preview", { film, section })).document;
}
export async function importWechatArticle(film: string, url: string) {
  return editorRequest<{ id: string; title: string; images: number }>("import-wechat", { film, url });
}
export async function convertWechatArticle(input: { film: string; mode: "content" | "link"; title: string; html: string; url: string }) {
  return editorRequest<{ title: string; articleHtml: string; images: number }>("convert-wechat", input);
}

export type AudiencePhoto = { id: string; film: string; displayName: string; caption: string; image: string; status: "pending" | "approved" | "rejected"; revision: number; createdAt: number };
export async function submitAudiencePhoto(input: { film: string; submissionId: string; uploadToken: string; imageData: string; displayName: string; caption: string; consent: boolean }) {
  const config = await loadConfig();
  if (!config.publicApiUrl) throw new Error("照片投稿暂时不可用");
  const request = async (action: string, data: object) => {
    const endpoint = new URL(config.publicApiUrl!); endpoint.searchParams.set("action", action);
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => ({})) as { received?: boolean; message?: string };
    if (!response.ok || !result.received) throw new Error(result.message || "提交失败，请稍后重试");
  };
  const contentHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input.imageData)))).map(value => value.toString(16).padStart(2, "0")).join("");
  const base64 = input.imageData.slice(input.imageData.indexOf(",") + 1);
  const parts = Math.ceil(base64.length / 60000);
  const identity = { submissionId: input.submissionId, uploadToken: input.uploadToken };
  await request("photo-upload-start", { ...identity, film: input.film, displayName: input.displayName, caption: input.caption, consent: input.consent, parts, contentHash });
  for (let start = 0; start < parts; start += 4) {
    const results = await Promise.allSettled(Array.from({ length: Math.min(4, parts - start) }, (_, offset) => { const index = start + offset; return request("photo-upload-part", { ...identity, index, chunk: base64.slice(index * 60000, (index + 1) * 60000) }); }));
    const failed = results.find(result => result.status === "rejected"); if (failed?.status === "rejected") throw failed.reason;
  }
  await request("photo-upload-finish", identity);
}
export async function listAudiencePhotos(film: string, status: AudiencePhoto["status"], offset: number) {
  return editorRequest<{ items: AudiencePhoto[]; hasMore: boolean }>("photo-submissions-list", { film, status, offset });
}
export async function reviewAudiencePhoto(item: AudiencePhoto, status: "approved" | "rejected") {
  return editorRequest("photo-submissions-review", { id: item.id, revision: item.revision, status });
}

export async function saveEditorPresentation(film: string, presentation: ArchivePresentation) {
  return (await editorRequest<{ presentation: ArchivePresentation }>("presentation-save", { film, presentation })).presentation;
}

export async function loadAdminCardCreations(role: ArchiveRole): Promise<AdminCardCreation[]> {
  if (role !== "admin") throw new Error("只有管理员可以查看用户作品");
  const app = await getArchiveApp();
  const response = await app.callFunction({
    name: "archive-api",
    data: { action: "admin-cards" },
    parse: true,
  });
  const payload = response.result as { ok?: boolean; cards?: AdminCardCreation[]; message?: string };
  if (!payload?.ok) throw new Error(payload?.message || "用户作品加载失败");
  return payload.cards ?? [];
}

export async function setCardCreationStatus(role: ArchiveRole, id: string, status: "published" | "hidden") {
  if (role !== "admin") throw new Error("只有管理员可以管理用户作品");
  const app = await getArchiveApp();
  const response = await app.callFunction({
    name: "archive-api",
    data: { action: "set-card-status", id, status },
    parse: true,
  });
  const payload = response.result as { ok?: boolean; message?: string };
  if (!payload?.ok) throw new Error(payload?.message || "作品状态更新失败");
}

export async function deleteCardCreation(role: ArchiveRole, id: string) {
  if (role !== "admin") throw new Error("只有管理员可以删除用户作品");
  const app = await getArchiveApp();
  const response = await app.callFunction({
    name: "archive-api",
    data: { action: "delete-card", id },
    parse: true,
  });
  const payload = response.result as { ok?: boolean; message?: string };
  if (!payload?.ok) throw new Error(payload?.message || "作品删除失败");
}

export async function downloadAllCardCreations(role: ArchiveRole, cardType: AdminCardCreation["cardType"]) {
  if (role !== "admin") throw new Error("只有管理员可以下载用户作品");
  const app = await getArchiveApp();
  const response = await app.callFunction({
    name: "archive-api",
    data: { action: "export-card-images", cardType },
    parse: true,
  });
  const payload = response.result as { ok?: boolean; downloadUrl?: string; filename?: string; count?: number; message?: string };
  if (!payload?.ok || !payload.downloadUrl) throw new Error(payload?.message || "图片打包失败");
  return {
    downloadUrl: payload.downloadUrl,
    filename: payload.filename || `cosmosfilm-${cardType}.zip`,
    count: payload.count ?? 0,
  };
}
