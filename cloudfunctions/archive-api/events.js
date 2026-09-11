const defaults = [
  { slug: "obsession", title: "OBSESSION", zhTitle: "迷恋", issue: "01", date: "", location: "", summary: "", status: "published" },
  { slug: "kill-bill", title: "KILL BILL", zhTitle: "杀死比尔", issue: "02", date: "", location: "", summary: "", status: "published" },
];
function eventsService(db) {
  const ref = () => db.collection("archive_content").doc("event-catalog");
  async function get() {
    const result = await ref().get();
    const record = Array.isArray(result.data) ? result.data[0] : result.data;
    return record?.settings || { revision: 0, events: defaults };
  }
  async function exists(slug, published = false) {
    return (await get()).events.some(event => event.slug === slug && (!published || event.status === "published"));
  }
  async function save(input, uid) {
    if (!input || !Number.isSafeInteger(input.revision) || !Array.isArray(input.events) || input.events.length > 500) throw new Error("活动列表不正确");
    const seen = new Set();
    const events = input.events.map(event => {
      if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(event.slug) || ["admin", "event"].includes(event.slug) || seen.has(event.slug)) throw new Error("活动标识重复或格式不正确");
      seen.add(event.slug);
      if (!["draft", "published"].includes(event.status)) throw new Error("活动状态不正确");
      if (event.date && (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || !Number.isFinite(Date.parse(event.date)) || new Date(event.date).toISOString().slice(0, 10) !== event.date)) throw new Error("活动日期不正确");
      const clean = (key, max) => String(event[key] || "").replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, max);
      const title = clean("title", 100), zhTitle = clean("zhTitle", 100);
      if (!title || !zhTitle) throw new Error("请填写活动名称");
      const ticketUrl = String(event.ticketUrl || "").trim();
      if (ticketUrl) {
        let url;
        try { url = new URL(ticketUrl); } catch { throw new Error("请填写完整的购票链接"); }
        const wechat = url.protocol === "weixin:" && url.hostname === "dl" && url.pathname === "/business/" && Boolean(url.searchParams.get("t"));
        if (ticketUrl.length > 2000 || url.username || url.password || (url.protocol !== "https:" && !wechat)) throw new Error("购票链接须为 HTTPS 链接或微信小程序跳转链接");
      }
      return { slug: event.slug, title, zhTitle, issue: clean("issue", 20), date: event.date || "", location: clean("location", 200), summary: clean("summary", 1000), ticketUrl, status: event.status };
    });
    await db.runTransaction(async tx => {
      const doc = tx.collection("archive_content").doc("event-catalog");
      const result = await doc.get();
      const previous = (Array.isArray(result.data) ? result.data[0] : result.data)?.settings || { revision: 0, events: defaults };
      if (previous.revision !== input.revision) throw new Error("活动列表已被更新，请重新加载后调整");
      if (previous.events.some(event => !seen.has(event.slug))) throw new Error("请将活动设为草稿以收起，不能移除已有活动");
      await doc.set({ section: "event-settings", status: "settings", updatedBy: uid, updatedAt: Date.now(), settings: { revision: input.revision + 1, events } });
    });
    return get();
  }
  return { get, save, exists };
}
module.exports = { eventsService };
