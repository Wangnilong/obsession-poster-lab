/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");
const cloudbase = require("@cloudbase/node-sdk");
const JSZip = require("jszip");

const cloud = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = cloud.database();

const allowedOrigins = new Set([
  "https://cosmosfilm42.cn",
  "https://www.cosmosfilm42.cn",
  "https://cosmosfilm42.spiffy-moose-2906.chatgpt.site",
  "https://cosmosfilm42-admin-d8c82218a2fad-1325477277.tcloudbaseapp.com",
]);
const allowedFilms = new Set(["obsession", "kill-bill"]);
const allowedSections = new Set(["articles", "photos", "tools", "merch"]);
const allowedCardTypes = new Set(["death-list", "killer-license"]);
const adminUserIds = new Set([
  "2084617266415722497",
  "2084617281419927554",
  "2084617296435154946",
  "2084617312926359553",
]);

function requestOrigin(event) {
  return event.headers?.origin || event.headers?.Origin || "";
}

function responseHeaders(event) {
  const origin = requestOrigin(event);
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://cosmosfilm42.cn",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

function json(statusCode, headers, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

function parseBody(event) {
  if (event.body && typeof event.body === "object") return event.body;
  const rawBody = event.isBase64Encoded
    ? Buffer.from(String(event.body || ""), "base64").toString("utf8")
    : String(event.body || "");
  return rawBody ? JSON.parse(rawBody) : {};
}

function cleanText(value, maxLength) {
  return String(value || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, maxLength);
}

async function getTemporaryUrls(fileIDs) {
  const temporaryUrls = new Map();
  if (!fileIDs.length) return temporaryUrls;
  for (let start = 0; start < fileIDs.length; start += 50) {
    const urlResult = await cloud.getTempFileURL({ fileList: fileIDs.slice(start, start + 50) });
    for (const file of urlResult.fileList || []) {
      if (file.fileID && file.tempFileURL) temporaryUrls.set(file.fileID, file.tempFileURL);
    }
  }
  return temporaryUrls;
}

async function listAllCardRecords(cardType) {
  const records = [];
  const pageSize = 100;
  let offset = 0;
  while (true) {
    const result = await db.collection("card_creations")
      .where({ film: "kill-bill" })
      .orderBy("createdAt", "desc")
      .skip(offset)
      .limit(pageSize)
      .get();
    const page = result.data || [];
    records.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return records.filter((record) => (
    record.source !== "bootstrap"
    && allowedCardTypes.has(record.cardType)
    && (!cardType || record.cardType === cardType)
  ));
}

async function listCards(headers) {
  try {
    const query = db.collection("card_creations").where({
      film: "kill-bill",
      visibility: "public",
      status: "published",
    });
    const result = await query.orderBy("createdAt", "desc").limit(48).get();
    const records = (result.data || []).filter((record) => record.cardType === "killer-license");
    const temporaryUrls = await getTemporaryUrls([...new Set(records.map((record) => record.fileID).filter(Boolean))]);
    return json(200, headers, {
      total: records.length,
      cards: records.map((record) => ({
        id: record._id,
        cardType: record.cardType,
        displayName: record.displayName,
        image: temporaryUrls.get(record.fileID),
        createdAt: record.createdAt,
      })).filter((record) => record.image),
    });
  } catch (error) {
    console.error("card list failed", error);
    return json(200, headers, { total: 0, cards: [] });
  }
}

function requireAdmin() {
  const userInfo = cloud.auth().getUserInfo();
  const uid = cleanText(userInfo?.uid, 64);
  if (!adminUserIds.has(uid)) throw new Error("只有管理员可以查看和管理用户作品");
  return uid;
}

async function listAdminCards() {
  requireAdmin();
  const records = await listAllCardRecords();
  const temporaryUrls = await getTemporaryUrls([...new Set(records.map((record) => record.fileID).filter(Boolean))]);
  return {
    ok: true,
    cards: records.map((record) => ({
      id: record._id,
      cardType: record.cardType,
      displayName: record.displayName,
      image: temporaryUrls.get(record.fileID) || "",
      createdAt: record.createdAt,
      status: record.status === "hidden" ? "hidden" : "published",
      visibility: record.cardType === "death-list" ? "private" : (record.visibility === "public" ? "public" : "private"),
    })),
  };
}

async function setCardStatus(event) {
  requireAdmin();
  const id = cleanText(event.id, 128);
  const status = cleanText(event.status, 16);
  if (!id || !["published", "hidden"].includes(status)) throw new Error("作品状态参数不正确");
  const result = await db.collection("card_creations").doc(id).get();
  const record = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!record || record.cardType !== "killer-license" || record.visibility !== "public") {
    throw new Error("只有用户主动公开的身份小卡可以调整作品墙状态");
  }
  await db.collection("card_creations").doc(id).update({ status });
  return { ok: true };
}

function safeArchiveName(value, fallback) {
  const cleaned = cleanText(value, 32).replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, "-");
  return cleaned || fallback;
}

async function exportCardImages(event) {
  requireAdmin();
  const cardType = cleanText(event.cardType, 32);
  if (!allowedCardTypes.has(cardType)) throw new Error("请选择要下载的作品模块");
  const records = await listAllCardRecords(cardType);
  if (!records.length) throw new Error(cardType === "death-list" ? "现在还没有暗杀名单" : "现在还没有身份小卡");

  const zip = new JSZip();
  for (let start = 0; start < records.length; start += 10) {
    const batch = records.slice(start, start + 10);
    const downloaded = await Promise.all(batch.map(async (record) => {
      if (!record.fileID) return null;
      const file = await cloud.downloadFile({ fileID: record.fileID });
      return { record, fileContent: file.fileContent };
    }));
    for (let index = 0; index < downloaded.length; index += 1) {
      const item = downloaded[index];
      if (!item?.fileContent) continue;
      const absoluteIndex = start + index + 1;
      const date = new Date(item.record.createdAt || Date.now()).toISOString().slice(0, 10);
      const name = safeArchiveName(item.record.displayName, "anonymous");
      zip.file(`${String(absoluteIndex).padStart(4, "0")}-${date}-${name}.jpg`, item.fileContent);
    }
  }

  const exportLabel = cardType === "death-list" ? "death-lists" : "killer-licenses";
  const filename = `cosmosfilm-${exportLabel}-${new Date().toISOString().slice(0, 10)}.zip`;
  const fileContent = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const cloudPath = `admin-exports/kill-bill/${Date.now()}-${crypto.randomUUID()}.zip`;
  const upload = await cloud.uploadFile({ cloudPath, fileContent });
  const temporaryUrls = await getTemporaryUrls([upload.fileID]);
  const downloadUrl = temporaryUrls.get(upload.fileID);
  if (!downloadUrl) throw new Error("下载包链接生成失败，请重试");
  return { ok: true, downloadUrl, filename, count: records.length };
}

async function createCard(event, headers) {
  const origin = requestOrigin(event);
  if (!allowedOrigins.has(origin)) return json(403, headers, { message: "当前网站来源不能提交作品" });

  let payload;
  try {
    payload = parseBody(event);
  } catch {
    return json(400, headers, { message: "提交内容无法读取" });
  }

  const requestedCardType = cleanText(payload.cardType || payload.type, 32);
  const cardType = !requestedCardType || ["id-card", "killer-card", "license"].includes(requestedCardType)
    ? "killer-license"
    : requestedCardType;
  const displayName = cleanText(payload.displayName || payload.name, 32);
  const requestedVisibility = cleanText(payload.visibility, 16);
  const visibility = ["public", "private"].includes(requestedVisibility)
    ? requestedVisibility
    : (payload.consentToPublish === true ? "public" : "private");
  const clientCreationId = cleanText(payload.clientCreationId, 64) || `legacy-${crypto.randomUUID()}`;
  if (!allowedCardTypes.has(cardType)) {
    console.warn("card submission rejected: unsupported type", { requestedCardType, origin });
    return json(400, headers, { message: "网页版本较旧，请刷新后再保存一次" });
  }
  if (!displayName) {
    console.warn("card submission rejected: empty display name", { cardType, origin });
    return json(400, headers, { message: "请先填写卡面姓名" });
  }
  if (payload.consentToStore === false) {
    return json(400, headers, { message: "保存作品前需要确认留档说明" });
  }
  if (cardType === "death-list" && visibility !== "private") {
    return json(400, headers, { message: "暗杀名单只允许后台留档，不会公开展示" });
  }
  if (visibility === "public" && payload.consentToPublish !== true) {
    return json(400, headers, { message: "公开展示前需要确认授权" });
  }

  const imageMatch = String(payload.imageData || "").match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!imageMatch) return json(400, headers, { message: "作品图片格式不支持" });
  const fileContent = Buffer.from(imageMatch[2], "base64");
  if (!fileContent.length || fileContent.length > 64 * 1024) {
    return json(413, headers, { message: "作品图片过大，请重新生成后再试" });
  }

  const extension = imageMatch[1] === "jpeg" ? "jpg" : imageMatch[1];
  const now = Date.now();
  const cloudPath = `community/kill-bill/${new Date(now).toISOString().slice(0, 10)}/${now}-${crypto.randomUUID()}.${extension}`;

  try {
    const upload = await cloud.uploadFile({ cloudPath, fileContent });
    const fileID = upload.fileID;
    const existingResult = await db.collection("card_creations")
      .where({ film: "kill-bill", clientCreationId })
      .limit(1)
      .get();
    const existing = (existingResult.data || [])[0];
    let id;
    if (existing) {
      const nextVisibility = existing.visibility === "public" || visibility === "public" ? "public" : "private";
      const nextStatus = nextVisibility === "public"
        ? (existing.visibility === "public" && existing.status === "hidden" ? "hidden" : "published")
        : "hidden";
      await db.collection("card_creations").doc(existing._id).update({
        displayName,
        fileID,
        visibility: nextVisibility,
        status: nextStatus,
        updatedAt: now,
      });
      id = existing._id;
      if (existing.fileID && existing.fileID !== fileID) {
        try {
          await cloud.deleteFile({ fileList: [existing.fileID] });
        } catch (error) {
          console.warn("old card image cleanup failed", error);
        }
      }
    } else {
      const created = await db.collection("card_creations").add({
        film: "kill-bill",
        issue: "02",
        cardType,
        displayName,
        fileID,
        visibility,
        status: visibility === "public" ? "published" : "hidden",
        createdAt: now,
        updatedAt: now,
        clientCreationId,
        source: "kill-bill-generator",
      });
      id = created.id || created._id;
    }
    const temporaryUrls = await getTemporaryUrls([fileID]);
    return json(existing ? 200 : 201, headers, { id, image: temporaryUrls.get(fileID), visibility });
  } catch (error) {
    console.error("card creation failed", error);
    return json(500, headers, { message: "作品暂时保存失败，请稍后再试" });
  }
}

async function listArchive(event, headers) {
  const film = String(event.queryStringParameters?.film || "");
  const section = String(event.queryStringParameters?.section || "");
  if (!allowedFilms.has(film) || !allowedSections.has(section)) {
    return json(400, headers, { entries: [] });
  }

  try {
    const result = await db.collection("archive_content").where({ film, section, status: "published" }).orderBy("createdAt", "desc").get();
    const records = result.data || [];
    const fileIDs = [...new Set(records.flatMap((record) => [record.fileID, ...(record.layout || []).map((block) => block.fileID)]).filter(Boolean))];
    const temporaryUrls = await getTemporaryUrls(fileIDs);

    return json(200, headers, {
      entries: records.map((record) => ({
        title: record.title,
        meta: record.meta,
        copy: record.copy,
        href: record.href,
        action: record.action,
        image: record.fileID ? temporaryUrls.get(record.fileID) : undefined,
        imageAlt: record.imageAlt,
        layout: (record.layout || []).map((block) => block.type === "image"
          ? { ...block, image: block.fileID ? temporaryUrls.get(block.fileID) : undefined, fileID: undefined }
          : block),
      })),
    });
  } catch (error) {
    console.error("archive list failed", error);
    return json(500, headers, { entries: [] });
  }
}

exports.main = async (event = {}) => {
  if (!event.httpMethod && event.action === "admin-cards") {
    try {
      return await listAdminCards();
    } catch (error) {
      console.error("admin card list failed", error);
      return { ok: false, message: error instanceof Error ? error.message : "用户作品加载失败" };
    }
  }
  if (!event.httpMethod && event.action === "set-card-status") {
    try {
      return await setCardStatus(event);
    } catch (error) {
      console.error("card status update failed", error);
      return { ok: false, message: error instanceof Error ? error.message : "作品状态更新失败" };
    }
  }
  if (!event.httpMethod && event.action === "export-card-images") {
    try {
      return await exportCardImages(event);
    } catch (error) {
      console.error("card image export failed", error);
      return { ok: false, message: error instanceof Error ? error.message : "图片打包失败" };
    }
  }

  const headers = responseHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const action = String(event.queryStringParameters?.action || "");
  if (action === "cards" && event.httpMethod === "GET") return listCards(headers);
  if (action === "create-card" && event.httpMethod === "POST") return createCard(event, headers);
  if (event.httpMethod && event.httpMethod !== "GET") return json(405, headers, { message: "请求方式不支持" });
  return listArchive(event, headers);
};
