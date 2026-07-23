import { generateImage } from "ai";

const ALLOWED_ORIGINS = new Set([
  "https://obsession-poster.vercel.app",
  "https://www.cosmosfilm42.cn",
  "https://cosmosfilm42.cn",
  "https://obsession-fnhgqz83.edgeone.cool",
  "https://cosmos-film-42.kurisurakko.chatgpt.site",
]);

const MAX_INPUT_BYTES = 14 * 1024 * 1024;
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 3;
const recentRequests = new Map();

const EDIT_PROMPT = `
Edit the supplied photograph into a finished psychological-horror movie portrait.

PRESERVE EXACTLY:
- the same photographed person and identity;
- the original pose, body proportions, crop, camera angle and centered composition;
- both real hands, every visible finger, the vase shape and its position;
- the complete real flower bouquet, leaves and stems;
- the fact that the flowers obscure the face;
- the original clothing.

CHANGE ONLY THE ENVIRONMENT AND LIGHTING:
- replace the existing room with an understated late-1970s dark interior;
- aged charcoal and dirty warm-gray walls with faint tall rectangular window light;
- deep cinematic space, subtle dust, organic 35mm grain and gentle optical softness;
- add a restrained, unsettling dark-crimson backlight behind the head and shoulders;
- let a small amount of believable red rim light touch the hair, flowers, shoulders and hands;
- keep the overall frame very dark, but expose the person, hands, vase and flowers clearly;
- natural skin, believable anatomy and photographic texture.

The result must look like one photograph captured with practical lighting, not a cutout,
collage, radial gradient, digital glow, or fantasy illustration.

Do not add, remove or replace fingers, hands, flowers, leaves, clothing or the vase.
No extra person. No visible face. No text, title, logo, border, watermark or poster typography.
`.trim();

function corsHeaders(request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed =
    ALLOWED_ORIGINS.has(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "https://obsession-poster.vercel.app",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function errorResponse(request, status, code, message) {
  return Response.json(
    { error: message, code },
    {
      status,
      headers: {
        ...corsHeaders(request),
        "Cache-Control": "no-store",
      },
    },
  );
}

function isRateLimited(request) {
  const forwarded = request.headers.get("x-forwarded-for") ?? "unknown";
  const ip = forwarded.split(",")[0].trim();
  const now = Date.now();
  const previous = recentRequests.get(ip) ?? [];
  const active = previous.filter((timestamp) => now - timestamp < RATE_WINDOW_MS);
  active.push(now);
  recentRequests.set(ip, active);
  return active.length > RATE_LIMIT;
}

export const config = {
  maxDuration: 300,
  api: {
    bodyParser: false,
  },
};

const webHandler = {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }
    if (request.method !== "POST") {
      return errorResponse(request, 405, "method_not_allowed", "Only POST is supported.");
    }
    if (isRateLimited(request)) {
      return errorResponse(request, 429, "rate_limited", "生成太频繁，请一分钟后再试。");
    }

    let incoming;
    try {
      incoming = await request.formData();
    } catch {
      return errorResponse(request, 400, "invalid_form", "无法读取上传的照片。");
    }

    const image = incoming.get("image");
    if (!(image instanceof File)) {
      return errorResponse(request, 400, "missing_image", "请先上传人物照片。");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type)) {
      return errorResponse(request, 415, "unsupported_image", "仅支持 JPG、PNG 或 WebP。");
    }
    if (image.size > MAX_INPUT_BYTES) {
      return errorResponse(request, 413, "image_too_large", "照片超过 14 MB，请换一张重试。");
    }

    let generated;
    try {
      generated = await generateImage({
        model: "openai/gpt-image-2",
        prompt: {
          images: [new Uint8Array(await image.arrayBuffer())],
          text: EDIT_PROMPT,
        },
        n: 1,
        size: "2048x2896",
        providerOptions: {
          openai: {
            quality: "high",
            outputFormat: "jpeg",
            outputCompression: 94,
          },
        },
        maxRetries: 1,
        abortSignal: AbortSignal.timeout(285_000),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("credit") || message.includes("quota") || message.includes("429")) {
        return errorResponse(
          request,
          429,
          "gateway_quota",
          "本月 AI 额度暂时不足，请在 Vercel AI Gateway 补充额度。",
        );
      }
      if (message.includes("auth") || message.includes("oidc") || message.includes("401")) {
        return errorResponse(
          request,
          503,
          "gateway_auth",
          "Vercel AI Gateway 尚未启用，请在项目后台开启后重试。",
        );
      }
      return errorResponse(
        request,
        504,
        "image_edit_failed",
        "AI 暂时没有生成成功，请保持页面打开后重试。",
      );
    }

    const first = generated?.image;
    if (!first?.uint8Array?.byteLength) {
      return errorResponse(request, 502, "missing_output", "AI 没有返回图片，请重试。");
    }
    const bytes = Buffer.from(first.uint8Array);
    const mediaType = first.mediaType || "image/jpeg";

    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        "Content-Type": mediaType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};

export default async function handler(request, response) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const method = request.method || "GET";
  const url = `https://${request.headers.host || "obsession-poster.vercel.app"}${request.url || "/api/generate-poster"}`;
  const webRequest = new Request(url, {
    method,
    headers,
    body: method === "GET" || method === "HEAD" || method === "OPTIONS"
      ? undefined
      : request,
    duplex: "half",
  });
  const webResponse = await webHandler.fetch(webRequest);
  response.statusCode = webResponse.status;
  for (const [key, value] of webResponse.headers) {
    response.setHeader(key, value);
  }
  response.end(Buffer.from(await webResponse.arrayBuffer()));
}
