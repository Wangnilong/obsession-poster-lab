const sections = ["articles", "photos", "tools", "merch"];
const films = ["obsession", "kill-bill"];

function imageKeys(record) {
  const seen = new Map();
  return (record.layout || []).map((block, index) => {
    if (block.type !== "image") return "";
    const identity = block.fileID || String(index);
    const occurrence = seen.get(identity) || 0;
    seen.set(identity, occurrence + 1);
    return `${record._id}:image:${identity}:${occurrence}`;
  });
}

function defaultPresentation() {
  return { revision: 0, posterFileID: "", poster: "", posterX: 50, posterY: 50, sectionOrder: [...sections], itemOrders: { articles: [], photos: [], tools: [], merch: [] } };
}

function presentationService(db, getTemporaryUrls, exists = async film => films.includes(film)) {
  async function get(film) {
    if (!await exists(film)) throw new Error("场次不正确");
    const result = await db.collection("archive_content").doc(`presentation-${film}`).get();
    const record = Array.isArray(result.data) ? result.data[0] : result.data;
    const config = { ...defaultPresentation(), ...(record?.settings || {}) };
    const urls = await getTemporaryUrls(config.posterFileID ? [config.posterFileID] : []);
    return { ...config, poster: urls.get(config.posterFileID) || "" };
  }

  async function save(film, input, uid) {
    if (!await exists(film)) throw new Error("场次不正确");
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error("请刷新布局后重试");
    if (!Array.isArray(input.sectionOrder) || input.sectionOrder.length !== 4 || new Set(input.sectionOrder).size !== 4 || input.sectionOrder.some(section => !sections.includes(section))) throw new Error("栏目顺序不正确");
    if (![input.posterX, input.posterY].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error("海报位置不正确");
    if (typeof input.posterFileID !== "string" || input.posterFileID.length > 1024 || (input.posterFileID && !new RegExp(`^cloud://[^/]+/archive/${film}/covers/[^/]+$`).test(input.posterFileID))) throw new Error("请选择本场上传的海报");
    const itemOrders = {};
    for (const section of sections) {
      const order = input.itemOrders?.[section];
      if (!Array.isArray(order) || order.length > 10000 || order.some(key => typeof key !== "string" || key.length > 1500) || new Set(order).size !== order.length) throw new Error("内容顺序不正确");
      const allowed = new Set();
      if (section === "tools") {
        for (let index = 0; index < (film === "kill-bill" ? 2 : film === "obsession" ? 1 : 0); index++) allowed.add(`tool:${index}`);
      } else {
        for (let offset = 0; ; offset += 100) {
          const result = await db.collection("archive_content").where({ film, section, status: "published" }).orderBy("createdAt", "desc").skip(offset).limit(100).get();
          for (const record of result.data || []) {
            if (section === "articles") allowed.add(record._id);
            else {
              if (record.fileID) allowed.add(`${record._id}:cover`);
              imageKeys(record).filter(Boolean).forEach(key => allowed.add(key));
            }
          }
          if ((result.data || []).length < 100) break;
        }
      }
      if (order.some(key => !allowed.has(key))) throw new Error("内容已发生变化，请重新加载页面布局后保存");
      itemOrders[section] = order;
    }
    if (input.posterFileID) {
      const urls = await getTemporaryUrls([input.posterFileID]);
      if (!urls.get(input.posterFileID)) throw new Error("海报文件不可用，请重新上传");
    }
    await db.runTransaction(async transaction => {
      const document = transaction.collection("archive_content").doc(`presentation-${film}`);
      const result = await document.get();
      const previous = Array.isArray(result.data) ? result.data[0] : result.data;
      if ((previous?.settings?.revision || 0) !== input.revision) throw new Error("另一位管理员已更新布局，请重新加载后调整");
      await document.set({ film, section: "presentation", status: "settings", updatedAt: Date.now(), updatedBy: uid,
        settings: { revision: input.revision + 1, posterFileID: input.posterFileID, posterX: input.posterX, posterY: input.posterY, sectionOrder: input.sectionOrder, itemOrders } });
    });
    return get(film);
  }
  return { get, save };
}

module.exports = { imageKeys, presentationService, defaultPresentation };
