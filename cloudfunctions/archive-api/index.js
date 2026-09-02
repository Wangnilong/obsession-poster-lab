/* eslint-disable @typescript-eslint/no-require-imports */

const crypto = require("node:crypto");
const cloudbase = require("@cloudbase/node-sdk");

const cloud = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = cloud.database();

const allowedOrigins = new Set([
  "https://cosmosfilm42.cn",
  "https://www.cosmosfilm42.cn",
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
  const urlResult = await cloud.getTempFileURL({ fileList: fileIDs });
  for (const file of urlResult.fileList || []) {
    if (file.fileID && file.tempFileURL) temporaryUrls.set(file.fileID, file.tempFileURL);
  }
  return temporaryUrls;
}

async function listCards(headers) {
  try {
    const query = db.collection("card_creations").where({
      film: "kill-bill",
      visibility: "public",
      status: "published",
    });
    const [result, countResult] = await Promise.all([
      query.orderBy("createdAt", "desc").limit(48).get(),
      query.count(),
    ]);
    const records = result.data || [];
    const temporaryUrls = await getTemporaryUrls([...new Set(records.map((record) => record.fileID).filter(Boolean))]);
    return json(200, headers, {
      total: countResult.total || records.length,
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
  const result = await db.collection("card_creations")
    .where({ film: "kill-bill" })
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();
  const records = result.data || [];
  const temporaryUrls = await getTemporaryUrls([...new Set(records.map((record) => record.fileID).filter(Boolean))]);
  return {
    ok: true,
    cards: records.filter((record) => record.source !== "bootstrap").map((record) => ({
      id: record._id,
      cardType: record.cardType,
      displayName: record.displayName,
      image: temporaryUrls.get(record.fileID) || "",
      createdAt: record.createdAt,
      status: record.status === "hidden" ? "hidden" : "published",
    })),
  };
}

async function setCardStatus(event) {
  requireAdmin();
  const id = cleanText(event.id, 128);
  const status = cleanText(event.status, 16);
  if (!id || !["published", "hidden"].includes(status)) throw new Error("作品状态参数不正确");
  await db.collection("card_creations").doc(id).update({ status });
  return { ok: true };
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

  const cardType = cleanText(payload.cardType, 32);
  const displayName = cleanText(payload.displayName, 32);
  if (!allowedCardTypes.has(cardType) || !displayName) {
    return json(400, headers, { message: "作品类型或名字不正确" });
  }
  if (payload.consentToPublish !== true) {
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
    const created = await db.collection("card_creations").add({
      film: "kill-bill",
      issue: "02",
      cardType,
      displayName,
      fileID,
      visibility: "public",
      status: "published",
      createdAt: now,
      source: "kill-bill-generator",
    });
    const temporaryUrls = await getTemporaryUrls([fileID]);
    return json(201, headers, { id: created.id || created._id, image: temporaryUrls.get(fileID) });
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

  const headers = responseHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const action = String(event.queryStringParameters?.action || "");
  if (action === "cards" && event.httpMethod === "GET") return listCards(headers);
  if (action === "create-card" && event.httpMethod === "POST") return createCard(event, headers);
  if (event.httpMethod && event.httpMethod !== "GET") return json(405, headers, { message: "请求方式不支持" });
  return listArchive(event, headers);
};
