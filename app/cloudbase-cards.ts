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
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ...input, consentToPublish: true }),
    });
  } catch {
    throw new Error("作品没有传上去，请检查网络后再试一次");
  }
  return readJson<{ id: string; image: string }>(response);
}

function dataUrlByteLength(dataUrl: string) {
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.floor(encoded.length * 0.75);
}

export function canvasToShareImage(canvas: HTMLCanvasElement, targetBytes = 52 * 1024) {
  const output = document.createElement("canvas");
  const context = output.getContext("2d");
  if (!context) throw new Error("浏览器无法处理这张图片");

  let maxDimension = Math.min(900, Math.max(canvas.width, canvas.height));
  let latest = "";
  while (maxDimension >= 360) {
    const scale = Math.min(1, maxDimension / Math.max(canvas.width, canvas.height));
    output.width = Math.max(1, Math.round(canvas.width * scale));
    output.height = Math.max(1, Math.round(canvas.height * scale));
    context.fillStyle = "#f8f6dc";
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0, output.width, output.height);

    for (const quality of [0.78, 0.66, 0.54, 0.44]) {
      latest = output.toDataURL("image/jpeg", quality);
      if (dataUrlByteLength(latest) <= targetBytes) return latest;
    }
    maxDimension = Math.floor(maxDimension * 0.78);
  }

  latest = output.toDataURL("image/jpeg", 0.34);
  if (dataUrlByteLength(latest) > targetBytes) throw new Error("网页展示图生成失败，请换一张照片后重试");
  return latest;
}
