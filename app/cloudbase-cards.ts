export type KillBillCardType = "death-list" | "killer-license";

export type PublicCardCreation = {
  id: string;
  cardType: KillBillCardType;
  displayName: string;
  image: string;
  createdAt: number;
};

type CloudBaseConfig = {
  publicApiUrl?: string;
};

async function loadPublicApiUrl() {
  const response = await fetch("/cloudbase-config.json", { cache: "no-store" });
  if (!response.ok) throw new Error("作品保存服务暂时不可用");
  const config = await response.json() as CloudBaseConfig;
  if (!config.publicApiUrl) throw new Error("作品保存服务尚未配置");
  return config.publicApiUrl;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(payload.message || "作品保存失败，请稍后再试");
  return payload;
}

export async function loadPublicCardCreations(): Promise<{ cards: PublicCardCreation[]; total: number }> {
  const apiUrl = await loadPublicApiUrl();
  const endpoint = new URL(apiUrl);
  endpoint.searchParams.set("action", "cards");
  const response = await fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store" });
  return readJson<{ cards: PublicCardCreation[]; total: number }>(response);
}

export async function publishCardCreation(input: {
  cardType: KillBillCardType;
  displayName: string;
  imageData: string;
}) {
  const apiUrl = await loadPublicApiUrl();
  const endpoint = new URL(apiUrl);
  endpoint.searchParams.set("action", "create-card");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ ...input, consentToPublish: true }),
  });
  return readJson<{ id: string; image: string }>(response);
}

export function canvasToShareImage(canvas: HTMLCanvasElement, maxDimension = 1600) {
  const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height));
  const output = document.createElement("canvas");
  output.width = Math.max(1, Math.round(canvas.width * scale));
  output.height = Math.max(1, Math.round(canvas.height * scale));
  const context = output.getContext("2d");
  if (!context) throw new Error("浏览器无法处理这张图片");
  context.drawImage(canvas, 0, 0, output.width, output.height);
  return output.toDataURL("image/jpeg", 0.88);
}
