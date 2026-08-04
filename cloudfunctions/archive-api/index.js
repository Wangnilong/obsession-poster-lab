/* eslint-disable @typescript-eslint/no-require-imports */

const cloudbase = require("@cloudbase/node-sdk");

const cloud = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = cloud.database();

const allowedOrigins = new Set([
  "https://cosmosfilm42.cn",
  "https://www.cosmosfilm42.cn",
]);
const allowedFilms = new Set(["obsession", "kill-bill"]);
const allowedSections = new Set(["articles", "photos", "tools", "merch"]);

function responseHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://cosmosfilm42.cn",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

exports.main = async (event = {}) => {
  const headers = responseHeaders(event);
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };

  const film = String(event.queryStringParameters?.film || "");
  const section = String(event.queryStringParameters?.section || "");
  if (!allowedFilms.has(film) || !allowedSections.has(section)) {
    return { statusCode: 400, headers, body: JSON.stringify({ entries: [] }) };
  }

  try {
    const result = await db
      .collection("archive_content")
      .where({ film, section, status: "published" })
      .orderBy("createdAt", "desc")
      .get();
    const records = result.data || [];
    const fileIDs = records.map((record) => record.fileID).filter(Boolean);
    const temporaryUrls = new Map();

    if (fileIDs.length) {
      const urlResult = await cloud.getTempFileURL({ fileList: fileIDs });
      for (const file of urlResult.fileList || []) {
        if (file.fileID && file.tempFileURL) temporaryUrls.set(file.fileID, file.tempFileURL);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        entries: records.map((record) => ({
          title: record.title,
          meta: record.meta,
          copy: record.copy,
          href: record.href,
          action: record.action,
          image: record.fileID ? temporaryUrls.get(record.fileID) : undefined,
          imageAlt: record.imageAlt,
        })),
      }),
    };
  } catch (error) {
    console.error("archive list failed", error);
    return { statusCode: 500, headers, body: JSON.stringify({ entries: [] }) };
  }
};
