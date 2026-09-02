import type { ArchiveEntry, ArchiveLayoutBlock, ArchiveSection } from "./archive-data";

type CloudBaseSdk = (typeof import("@cloudbase/js-sdk"))["default"];
type CloudBaseApp = ReturnType<CloudBaseSdk["init"]>;

export type ArchiveRole = "admin" | "photo-uploader";

export type AdminCardCreation = {
  id: string;
  cardType: "death-list" | "killer-license";
  displayName: string;
  image: string;
  createdAt: number;
  status: "published" | "hidden";
};

type CloudBaseConfig = {
  env: string;
  region: string;
  publicApiUrl?: string;
  adminUrl?: string;
};

type PublishedArchiveRecord = {
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
  status: "published";
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

export async function loadAdminCardCreations(role: ArchiveRole): Promise<AdminCardCreation[]> {
  if (role !== "admin") throw new Error("只有管理员可以查看用户作品");
  const app = await getArchiveApp();
  const result = await app.database()
    .collection("card_creations")
    .where({ film: "kill-bill" })
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const records = result.data as Array<{
    _id: string;
    cardType: "death-list" | "killer-license";
    displayName: string;
    fileID: string;
    createdAt: number;
    status: "published" | "hidden";
  }>;
  const fileIDs = records.map((record) => record.fileID).filter(Boolean);
  const temporaryUrls = new Map<string, string>();
  if (fileIDs.length) {
    const urlResult = await app.getTempFileURL({ fileList: fileIDs });
    for (const file of urlResult.fileList ?? []) {
      if (file.fileID && file.tempFileURL) temporaryUrls.set(file.fileID, file.tempFileURL);
    }
  }
  return records.map((record) => ({
    id: record._id,
    cardType: record.cardType,
    displayName: record.displayName,
    image: temporaryUrls.get(record.fileID) ?? "",
    createdAt: record.createdAt,
    status: record.status,
  }));
}

export async function setCardCreationStatus(role: ArchiveRole, id: string, status: "published" | "hidden") {
  if (role !== "admin") throw new Error("只有管理员可以管理用户作品");
  const app = await getArchiveApp();
  await app.database().collection("card_creations").doc(id).update({ status });
}
