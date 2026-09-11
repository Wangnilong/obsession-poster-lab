const defaults = require("./home-defaults.json");
function homeSettingsService(db, getUrls) {
  const row = result => Array.isArray(result.data) ? result.data[0] : result.data;
  const ref = () => db.collection("archive_content").doc("home-settings");
  async function get() {
    const saved = row(await ref().get())?.settings;
    const urls = await getUrls((saved?.slots || []).map(slot => slot.fileID).filter(Boolean));
    return { revision: saved?.revision || 0, slots: defaults.map(base => {
      const slot = saved?.slots?.find(item => item.key === base.key);
      return { ...base, fileID: "", x: 50, y: 50, ...slot, image: urls.get(slot?.fileID) || base.image };
    }) };
  }
  async function save(input, uid) {
    if (!input || !Number.isSafeInteger(input.revision) || input.revision < 0 || !Array.isArray(input.slots) || input.slots.length !== defaults.length || new Set(input.slots.map(slot => slot.key)).size !== defaults.length) throw new Error("首页配置不正确，请重新加载");
    const slots = defaults.map(base => {
      const slot = input.slots.find(item => item.key === base.key);
      if (!slot || typeof slot.title !== "string" || !slot.title.trim() || slot.title.length > 200 || typeof slot.copy !== "string" || slot.copy.length > 2000) throw new Error("请填写标题，说明不能超过 2000 字");
      if (![slot.x, slot.y].every(value => Number.isFinite(value) && value >= 0 && value <= 100)) throw new Error("图片裁切位置不正确");
      if (typeof slot.fileID !== "string" || slot.fileID.length > 1024 || (slot.fileID && !/^cloud:\/\/[^/]+\/archive\/home\/covers\/[^/]+$/.test(slot.fileID))) throw new Error("请选择首页上传的图片");
      return { key: base.key, title: slot.title.trim(), copy: slot.copy.trim(), fileID: slot.fileID, x: slot.x, y: slot.y };
    });
    const ids = slots.map(slot => slot.fileID).filter(Boolean);
    const urls = await getUrls(ids);
    if (ids.some(id => !urls.get(id))) throw new Error("部分图片不可用，请重新上传后保存");
    await db.runTransaction(async tx => {
      const doc = tx.collection("archive_content").doc("home-settings");
      if ((row(await doc.get())?.settings?.revision || 0) !== input.revision) throw new Error("首页已被其他管理员修改，请重新加载后调整");
      await doc.set({ section: "home-settings", status: "settings", updatedBy: uid, updatedAt: Date.now(), settings: { revision: input.revision + 1, slots } });
    });
    return get();
  }
  return { get, save };
}
module.exports = { homeSettingsService };
