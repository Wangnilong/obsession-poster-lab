const crypto = require("node:crypto");
const clean = (text, length) => String(text || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, length);
const first = result => Array.isArray(result.data) ? result.data[0] : result.data;

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) throw new Error("图片格式不正确，请重新选择照片");
  let index = 2;
  while (index + 8 < buffer.length) {
    if (buffer[index++] !== 0xff) break;
    while (buffer[index] === 0xff) index++;
    const marker = buffer[index++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(index);
    if (length < 2 || index + length > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      const height = buffer.readUInt16BE(index + 3), width = buffer.readUInt16BE(index + 5);
      if (!width || !height || width > 2400 || height > 2400 || width * height > 5760000) throw new Error("图片尺寸过大，请重新选择照片");
      return { width, height };
    }
    index += length;
  }
  throw new Error("无法读取这张照片，请换一张图片");
}

function photoSubmissionsService(db, cloud, events, temporaryUrls) {
  const doc = id => db.collection("archive_content").doc(id);
  async function submit(input, sourceIp = "", counted = false) {
    if (input.consent !== true) throw new Error("请先确认照片投稿授权");
    if (!/^[a-f0-9-]{36}$/.test(input.submissionId || "")) throw new Error("投稿编号无效，请刷新重试");
    if (!await events.exists(input.film, true)) throw new Error("这个活动暂时不能投稿，请重新选择");
    const data = String(input.imageData || "");
    if (data.length > 1400000) throw new Error("图片过大，请重新选择照片");
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
    if (!match) throw new Error("图片格式不正确，请重新选择照片");
    const buffer = Buffer.from(match[1], "base64");
    if (!buffer.length || buffer.length > 1024 * 1024) throw new Error("图片过大，请重新选择照片");
    jpegDimensions(buffer);
    const name = clean(input.displayName, 40) || "匿名观众", caption = clean(input.caption, 300);
    const hash = crypto.createHash("sha256").update(buffer).update(JSON.stringify([input.film, name, caption])).digest("hex");
    const id = `submission-${input.submissionId}`, attempt = crypto.randomUUID(), now = Date.now();
    const rateKey = `photo-rate-${Math.floor(now / 3600000)}`;
    const ipKey = sourceIp ? `${rateKey}-${crypto.createHash("sha256").update(sourceIp).digest("hex").slice(0, 24)}` : "";
    const admitted = await db.runTransaction(async tx => {
      const ref = tx.collection("archive_content").doc(id);
      const existing = first(await ref.get());
      if (existing) {
        if (existing.hash !== hash) throw new Error("投稿内容已改变，请重新选择照片再提交");
        if (["pending", "approved", "rejected"].includes(existing.status)) return false;
        if (existing.status === "uploading" && now - existing.updatedAt < 300000) throw new Error("这张照片正在提交，请稍后重试");
      }
      if (!existing && !counted) {
        const rateDoc = tx.collection("archive_content").doc(rateKey);
        const rate = first(await rateDoc.get());
        const ipDoc = ipKey ? tx.collection("archive_content").doc(ipKey) : null;
        const ipRate = ipDoc ? first(await ipDoc.get()) : null;
        if ((rate?.count || 0) >= 200 || (ipRate?.count || 0) >= 30) throw new Error("投稿较频繁，请稍后再来");
        await rateDoc.set({ section: "submission-rate", status: "settings", count: (rate?.count || 0) + 1, createdAt: now });
        if (ipDoc) await ipDoc.set({ section: "submission-rate", status: "settings", count: (ipRate?.count || 0) + 1, createdAt: now });
      }
      await ref.set({ section: "photo-submissions", film: input.film, status: "uploading", hash, attempt, displayName: name, caption, createdAt: existing?.createdAt || now, updatedAt: now, revision: 0 });
      return true;
    });
    if (!admitted) return { receipt: input.submissionId, received: true };
    let fileID;
    try {
      const upload = await cloud.uploadFile({ cloudPath: `audience/${input.film}/${attempt}.jpg`, fileContent: buffer });
      fileID = upload.fileID;
      await db.runTransaction(async tx => {
        const ref = tx.collection("archive_content").doc(id);
        const record = first(await ref.get());
        if (record?.attempt !== attempt || record.status !== "uploading") throw new Error("提交状态已改变，请稍后重试");
        await ref.update({ status: "pending", fileID, updatedAt: Date.now() });
      });
      return { receipt: input.submissionId, received: true };
    } catch (error) {
      await db.runTransaction(async tx => {
        const ref = tx.collection("archive_content").doc(id); const record = first(await ref.get());
        if (record?.attempt === attempt && record.status === "uploading") await ref.update({ status: "failed", updatedAt: Date.now() });
      }).catch(() => {});
      if (fileID) await cloud.deleteFile({ fileList: [fileID] }).catch(() => {});
      throw error;
    }
  }
  const sessionId = input => {
    if (!/^[a-f0-9-]{36}$/.test(input.submissionId || "") || !/^[a-f0-9-]{36}$/.test(input.uploadToken || "")) throw new Error("投稿编号无效，请重新选择照片");
    return `photo-upload-${input.submissionId}`;
  };
  const tokenHash = input => crypto.createHash("sha256").update(input.uploadToken).digest("hex");
  async function cleanupParts(session) {
    await Promise.all(Array.from({ length: session.parts }, (_, index) => doc(`${session._id}-part-${index}`).remove().catch(() => {})));
  }
  async function start(input, sourceIp) {
    const id = sessionId(input);
    if (input.consent !== true || !await events.exists(input.film, true)) throw new Error("请确认授权并选择公开活动");
    if (!Number.isInteger(input.parts) || input.parts < 1 || input.parts > 24 || !/^[a-f0-9]{64}$/.test(input.contentHash || "")) throw new Error("照片信息不正确");
    const hash = tokenHash(input), now = Date.now();
    // Remove expired partial uploads opportunistically; completed uploads are cleaned immediately.
    const old = await db.collection("archive_content").where({ section: "photo-upload", status: "uploading" }).orderBy("createdAt", "asc").limit(10).get();
    for (const record of old.data || []) if (now - record.createdAt > 86400000) { await cleanupParts(record); await doc(record._id).remove(); }
    await db.runTransaction(async tx => {
      const ref = tx.collection("archive_content").doc(id), existing = first(await ref.get());
      if (existing) {
        if (existing.tokenHash !== hash || existing.contentHash !== input.contentHash || existing.film !== input.film || existing.parts !== input.parts) throw new Error("投稿已改变，请重新选择照片");
        return;
      }
      const rateKey = `photo-rate-${Math.floor(now / 3600000)}`;
      const rateDoc = tx.collection("archive_content").doc(rateKey), rate = first(await rateDoc.get());
      const ipKey = sourceIp ? `${rateKey}-${crypto.createHash("sha256").update(sourceIp).digest("hex").slice(0,24)}` : "";
      const ipDoc = ipKey ? tx.collection("archive_content").doc(ipKey) : null, ipRate = ipDoc ? first(await ipDoc.get()) : null;
      if ((rate?.count || 0) >= 200 || (ipRate?.count || 0) >= 30) throw new Error("投稿较频繁，请稍后再来");
      await rateDoc.set({ section: "submission-rate", status: "settings", count: (rate?.count || 0) + 1, createdAt: now });
      if (ipDoc) await ipDoc.set({ section: "submission-rate", status: "settings", count: (ipRate?.count || 0) + 1, createdAt: now });
      await ref.set({ section: "photo-upload", status: "uploading", createdAt: now, film: input.film, tokenHash: hash, contentHash: input.contentHash, parts: input.parts, displayName: clean(input.displayName,40), caption: clean(input.caption,300), consent: true });
    });
    return { received: true };
  }
  async function part(input) {
    const id = sessionId(input);
    if (!Number.isInteger(input.index) || input.index < 0 || typeof input.chunk !== "string" || input.chunk.length > 60000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.chunk)) throw new Error("照片片段无效");
    await db.runTransaction(async tx => {
      const session = first(await tx.collection("archive_content").doc(id).get());
      if (!session || session.tokenHash !== tokenHash(input) || input.index >= session.parts) throw new Error("投稿已过期，请重新选择照片");
      if (session.status === "complete") return;
      const ref = tx.collection("archive_content").doc(`${id}-part-${input.index}`), existing = first(await ref.get());
      if (existing) { if (existing.chunk !== input.chunk) throw new Error("照片片段已改变，请重新选择照片"); return; }
      await ref.set({ section: "photo-upload-part", status: "uploading", chunk: input.chunk });
    });
    return { received: true };
  }
  async function finish(input, sourceIp) {
    const id = sessionId(input), session = first(await doc(id).get());
    if (!session || session.tokenHash !== tokenHash(input)) throw new Error("投稿已过期，请重新选择照片");
    if (session.status === "complete") return { receipt: input.submissionId, received: true };
    const chunks = await Promise.all(Array.from({ length: session.parts }, (_, index) => doc(`${id}-part-${index}`).get().then(first)));
    if (chunks.some(item => !item?.chunk)) throw new Error("照片尚未传完，请重试");
    const imageData = `data:image/jpeg;base64,${chunks.map(item => item.chunk).join("")}`;
    if (crypto.createHash("sha256").update(imageData).digest("hex") !== session.contentHash) throw new Error("照片传输不完整，请重新选择照片");
    const result = await submit({ ...session, submissionId: input.submissionId, imageData }, sourceIp, true);
    await doc(id).update({ status: "complete" });
    await cleanupParts({ ...session, _id: id });
    return result;
  }
  async function list(input) {
    if (!["pending", "approved", "rejected"].includes(input.status)) throw new Error("审核状态不正确");
    const filter = { section: "photo-submissions", status: input.status };
    if (input.film) filter.film = input.film;
    const offset = Math.max(0, Math.floor(Number(input.offset) || 0));
    const result = await db.collection("archive_content").where(filter).orderBy("createdAt", "desc").skip(offset).limit(51).get();
    const rows = result.data || [];
    const page = rows.slice(0, 50);
    const urls = await temporaryUrls(page.map(record => record.fileID));
    return { items: page.map(record => ({ id: record._id, film: record.film, displayName: record.displayName, caption: record.caption, image: urls.get(record.fileID), status: record.status, revision: record.revision, createdAt: record.createdAt })), hasMore: rows.length > 50 };
  }
  async function review(input, uid) {
    if (!/^submission-[a-f0-9-]{36}$/.test(input.id || "") || !["approved", "rejected"].includes(input.status) || !Number.isSafeInteger(input.revision)) throw new Error("审核请求不正确");
    await db.runTransaction(async tx => {
      const ref = tx.collection("archive_content").doc(input.id), record = first(await ref.get());
      if (!record || record.section !== "photo-submissions" || !["pending", "approved", "rejected"].includes(record.status)) throw new Error("投稿不存在或尚未提交完成");
      if (record.revision !== input.revision) throw new Error("这张照片已被其他管理员处理，请刷新列表");
      const target = tx.collection("archive_content").doc(`audience-photo-${input.id.slice(11)}`);
      const previous = first(await target.get());
      if (input.status === "approved") {
        const values = { film: record.film, section: "photos", title: record.caption || "观众活动照片", meta: `观众投稿 · ${record.displayName}`, imageAlt: record.caption || "观众活动照片", fileID: record.fileID, status: "published", source: "audience", submissionId: input.id, createdAt: record.createdAt, createdBy: record.displayName, updatedBy: uid, updatedAt: Date.now() };
        if (previous) await target.update({ status: "published", updatedBy: uid, updatedAt: Date.now() }); else await target.set(values);
      } else if (previous) await target.update({ status: "hidden", updatedBy: uid, updatedAt: Date.now() });
      await ref.update({ status: input.status, revision: record.revision + 1, reviewedBy: uid, reviewedAt: Date.now() });
    });
    return { ok: true };
  }
  return { submit, start, part, finish, list, review };
}
module.exports = { photoSubmissionsService, jpegDimensions };
