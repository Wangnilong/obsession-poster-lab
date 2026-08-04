import type { ArchiveEntry, ArchiveSection } from "./archive-data";

type CloudBaseSdk = (typeof import("@cloudbase/js-sdk"))["default"];
type CloudBaseApp = ReturnType<CloudBaseSdk["init"]>;

export type ArchiveRole = "admin" | "photo-uploader";

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
  createdAt: number;
  createdBy: string;
  status: "published";
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
}) {
  if (input.role === "photo-uploader" && input.section !== "photos") {
    throw new Error("这个账号只能上传映后图片");
  }
  if (input.section === "photos" && !input.file) {
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
