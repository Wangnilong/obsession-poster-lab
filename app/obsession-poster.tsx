"use client";

/* eslint-disable @next/next/no-img-element -- the EdgeOne/Vite build serves public assets directly */

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const A3_WIDTH = 3508;
const A3_HEIGHT = 4961;
const A4_WIDTH = 2480;
const A4_HEIGHT = 3508;
const PREVIEW_WIDTH = 707;
const PREVIEW_HEIGHT = 1000;
const MAX_WORKING_PIXELS = 12_000_000;
const MAX_WORKING_EDGE = 4200;

type Controls = {
  intensity: number;
  grain: number;
  vignette: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

type ToneProfile = {
  brightness: number;
  contrast: number;
  saturation: number;
  sepia: number;
  warmth: number;
};

type PoseLandmark = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

type PoseLandmarkerLike = {
  detectForVideo: (
    source: HTMLVideoElement,
    timestamp: number,
  ) => { landmarks: PoseLandmark[][] };
  close: () => void;
};

type PoseFeedback = {
  tone: "loading" | "good" | "adjust" | "missing";
  label: string;
  score: number;
};

type TimerSeconds = 0 | 3 | 10;
type OutputProfile = "screen" | "print";

type FaceDetectorResult = {
  boundingBox: { x: number; y: number; width: number; height: number };
};

type FaceDetectorConstructor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => {
  detect: (source: CanvasImageSource) => Promise<FaceDetectorResult[]>;
};

const DEFAULT_CONTROLS: Controls = {
  intensity: 78,
  grain: 44,
  vignette: 72,
  scale: 108,
  offsetX: 0,
  offsetY: 0,
};

const DEFAULT_TONE_PROFILE: ToneProfile = {
  brightness: 0.62,
  contrast: 1.12,
  saturation: 0.72,
  sepia: 0.12,
  warmth: 0.04,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type ImageDimensions = { width: number; height: number };

async function readImageDimensions(file: File): Promise<ImageDimensions | null> {
  const bytes = new Uint8Array(
    await file.slice(0, Math.min(file.size, 1024 * 1024)).arrayBuffer(),
  );

  if (
    bytes.length >= 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const startOfFrame = new Set([
      0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
      0xce, 0xcf,
    ]);
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (segmentLength < 2) break;
      if (startOfFrame.has(marker) && offset + 8 < bytes.length) {
        return {
          height: (bytes[offset + 5] << 8) | bytes[offset + 6],
          width: (bytes[offset + 7] << 8) | bytes[offset + 8],
        };
      }
      offset += segmentLength + 2;
    }
  }

  if (
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") {
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    }
    if (chunk === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
      return {
        width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
        height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && bytes[20] === 0x2f) {
      return {
        width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
        height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
      };
    }
  }

  return null;
}

async function prepareWorkingImage(file: File) {
  const dimensions = await readImageDimensions(file);
  if (!dimensions) {
    throw new Error("Unsupported image metadata");
  }
  if (typeof createImageBitmap !== "function") {
    if (
      dimensions.width * dimensions.height > MAX_WORKING_PIXELS ||
      Math.max(dimensions.width, dimensions.height) > MAX_WORKING_EDGE
    ) {
      throw new Error("Large image resize unsupported");
    }
    return { blob: file as Blob, dimensions, reduced: false };
  }

  const pixelScale = Math.sqrt(
    MAX_WORKING_PIXELS / (dimensions.width * dimensions.height),
  );
  const edgeScale = MAX_WORKING_EDGE / Math.max(dimensions.width, dimensions.height);
  const scale = Math.min(1, pixelScale, edgeScale);
  if (scale >= 1) {
    return { blob: file as Blob, dimensions, reduced: false };
  }

  const resizeWidth = Math.max(1, Math.round(dimensions.width * scale));
  const resizeHeight = Math.max(1, Math.round(dimensions.height * scale));
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
    resizeWidth,
    resizeHeight,
    resizeQuality: "high",
  });
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    bitmap.close();
    throw new Error("Image canvas unavailable");
  }
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Image resize failed"))),
      "image/jpeg",
      0.94,
    );
  });
  canvas.width = 1;
  canvas.height = 1;
  return { blob, dimensions, reduced: true };
}

function imageFromBlob(blob: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(blob);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image decode failed"));
    };
    image.src = url;
  });
}

function analyzeImageTone(image: HTMLImageElement): ToneProfile {
  const sample = document.createElement("canvas");
  const longestEdge = 180;
  const scale = longestEdge / Math.max(image.naturalWidth, image.naturalHeight);
  sample.width = Math.max(1, Math.round(image.naturalWidth * scale));
  sample.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = sample.getContext("2d", { willReadFrequently: true });
  if (!context) return DEFAULT_TONE_PROFILE;
  context.drawImage(image, 0, 0, sample.width, sample.height);

  const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
  const luminance: number[] = [];
  let saturationTotal = 0;
  let redTotal = 0;
  let blueTotal = 0;
  for (let index = 0; index < pixels.length; index += 16) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    luminance.push((red * 0.2126 + green * 0.7152 + blue * 0.0722) / 255);
    saturationTotal += (maximum - minimum) / Math.max(1, maximum);
    redTotal += red;
    blueTotal += blue;
  }
  luminance.sort((left, right) => left - right);
  if (!luminance.length) return DEFAULT_TONE_PROFILE;

  const percentile = (amount: number) =>
    luminance[Math.floor((luminance.length - 1) * amount)];
  const shadow = percentile(0.1);
  const highlight = percentile(0.9);
  const sourceRange = Math.max(0.16, highlight - shadow);
  const sourceSaturation = saturationTotal / luminance.length;
  const sourceWarmth = (redTotal - blueTotal) / luminance.length / 255;

  // The reference poster measures roughly P10 .05, P90 .41 and R-B .064.
  // Keep the central subject readable, while making the global result slightly
  // darker than the measured highlight level so bright phone photos do not look grey.
  return {
    brightness: clamp(0.4 / Math.max(0.22, highlight), 0.44, 1.12),
    contrast: clamp(0.34 / sourceRange, 0.96, 1.48),
    saturation: clamp(0.27 / Math.max(0.12, sourceSaturation), 0.56, 1.04),
    sepia: clamp(0.08 + Math.max(0, 0.064 - sourceWarmth) * 1.4, 0.06, 0.2),
    warmth: clamp((0.064 - sourceWarmth) * 1.6, 0, 0.1),
  };
}

function isVisible(point?: PoseLandmark, minimum = 0.42) {
  return Boolean(point && (point.visibility ?? 1) >= minimum);
}

function mapPoseToPoster(
  landmarks: PoseLandmark[],
  videoWidth: number,
  videoHeight: number,
  mirrored: boolean,
) {
  const targetRatio = A3_WIDTH / A3_HEIGHT;
  const sourceRatio = videoWidth / videoHeight;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = videoWidth;
  let sourceHeight = videoHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = videoHeight * targetRatio;
    sourceX = (videoWidth - sourceWidth) / 2;
  } else {
    sourceHeight = videoWidth / targetRatio;
    sourceY = (videoHeight - sourceHeight) / 2;
  }

  return landmarks.map((point) => {
    const x = (point.x * videoWidth - sourceX) / sourceWidth;
    return {
      ...point,
      x: mirrored ? 1 - x : x,
      y: (point.y * videoHeight - sourceY) / sourceHeight,
    };
  });
}

function readPose(landmarks: PoseLandmark[]) {
  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftWrist = landmarks[15];
  const rightWrist = landmarks[16];

  if (!isVisible(leftShoulder) || !isVisible(rightShoulder)) return null;

  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderWidth = Math.abs(leftShoulder.x - rightShoulder.x);
  const wristsVisible = isVisible(leftWrist, 0.34) && isVisible(rightWrist, 0.34);

  return {
    nose,
    leftShoulder,
    rightShoulder,
    leftWrist,
    rightWrist,
    shoulderCenterX,
    shoulderWidth,
    wristsVisible,
    wristCenterY: wristsVisible ? (leftWrist.y + rightWrist.y) / 2 : null,
    wristSeparation: wristsVisible ? Math.abs(leftWrist.x - rightWrist.x) : null,
  };
}

function evaluatePose(landmarks: PoseLandmark[]): PoseFeedback {
  const pose = readPose(landmarks);
  if (!pose) {
    return { tone: "missing", label: "往后一点，让肩膀和双手入镜", score: 0 };
  }

  if (pose.shoulderCenterX < 0.43) {
    return { tone: "adjust", label: "向右一点", score: 42 };
  }
  if (pose.shoulderCenterX > 0.57) {
    return { tone: "adjust", label: "向左一点", score: 42 };
  }
  if (pose.shoulderWidth < 0.25) {
    return { tone: "adjust", label: "再靠近一点", score: 55 };
  }
  if (pose.shoulderWidth > 0.58) {
    return { tone: "adjust", label: "稍微退后一点", score: 55 };
  }
  if (isVisible(pose.nose) && pose.nose.y > 0.34) {
    return { tone: "adjust", label: "镜头向上抬一点", score: 64 };
  }
  if (isVisible(pose.nose) && pose.nose.y < 0.1) {
    return { tone: "adjust", label: "镜头向下压一点", score: 64 };
  }
  if (!pose.wristsVisible) {
    return { tone: "adjust", label: "双手放到瓶身两侧", score: 70 };
  }
  if ((pose.wristSeparation ?? 0) < 0.15) {
    return { tone: "adjust", label: "双手再分开一点", score: 76 };
  }
  if ((pose.wristCenterY ?? 0) < 0.49) {
    return { tone: "adjust", label: "双手往下一点", score: 78 };
  }
  if ((pose.wristCenterY ?? 1) > 0.78) {
    return { tone: "adjust", label: "双手抬高一点", score: 78 };
  }

  return { tone: "good", label: "站位正确，可以拍", score: 100 };
}

function controlsFromPose(landmarks: PoseLandmark[]): Controls | null {
  const pose = readPose(landmarks);
  if (!pose) return null;

  const scale = clamp(Math.round(108 * (0.39 / pose.shoulderWidth)), 102, 132);
  const travel = Math.max(0.025, (scale / 100 - 1) / 2);
  const faceY = isVisible(pose.nose) ? pose.nose.y : 0.23;

  return {
    ...DEFAULT_CONTROLS,
    scale,
    offsetX: Math.round(clamp(((0.5 - pose.shoulderCenterX) / travel) * 100, -100, 100)),
    offsetY: Math.round(clamp(((0.23 - faceY) / travel) * 100, -100, 100)),
  };
}

function coverRect(
  imageWidth: number,
  imageHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  controls: Controls,
) {
  const baseScale = Math.max(
    canvasWidth / imageWidth,
    canvasHeight / imageHeight,
  );
  const scale = baseScale * (controls.scale / 100);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const travelX = Math.max(0, width - canvasWidth) / 2;
  const travelY = Math.max(0, height - canvasHeight) / 2;

  return {
    x: (canvasWidth - width) / 2 + (controls.offsetX / 100) * travelX,
    y: (canvasHeight - height) / 2 + (controls.offsetY / 100) * travelY,
    width,
    height,
  };
}

function seededNoise(size: number, amount: number) {
  const tile = document.createElement("canvas");
  tile.width = size;
  tile.height = size;
  const tileContext = tile.getContext("2d", { willReadFrequently: false });
  if (!tileContext) return tile;

  const pixels = tileContext.createImageData(size, size);
  let seed = 1847;
  for (let i = 0; i < pixels.data.length; i += 4) {
    seed = (seed * 16807) % 2147483647;
    const random = seed / 2147483647;
    const value = random > 0.52 ? 255 : 20;
    pixels.data[i] = value;
    pixels.data[i + 1] = value;
    pixels.data[i + 2] = value;
    pixels.data[i + 3] = Math.round(random * amount);
  }
  tileContext.putImageData(pixels, 0, 0);
  return tile;
}

function fitTitle(context: CanvasRenderingContext2D, width: number, height: number) {
  const title = "OBSESSION";
  let fontSize = height * 0.11;
  context.font = `${fontSize}px Anton, Impact, sans-serif`;
  while (context.measureText(title).width > width * 0.78 && fontSize > 16) {
    fontSize *= 0.97;
    context.font = `${fontSize}px Anton, Impact, sans-serif`;
  }
  return fontSize;
}

function renderPoster(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  image: HTMLImageElement | null,
  controls: Controls,
  toneProfile: ToneProfile,
  brandArt: HTMLImageElement | null = null,
  outputProfile: OutputProfile = "screen",
) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) return;

  context.fillStyle = "#0b0c0b";
  context.fillRect(0, 0, width, height);

  if (image) {
    const rect = coverRect(image.naturalWidth, image.naturalHeight, width, height, controls);
    const intensity = controls.intensity / 100;
    const screenBrightness = 1 + (toneProfile.brightness - 1) * intensity;
    const screenContrast = 1 + (toneProfile.contrast - 1) * intensity;
    const screenSaturation = 1 + (toneProfile.saturation - 1) * intensity;
    const brightness = outputProfile === "print" ? Math.min(1.08, screenBrightness * 1.32) : screenBrightness;
    const contrast = outputProfile === "print" ? 1 + (screenContrast - 1) * 0.42 : screenContrast;
    const saturation = outputProfile === "print" ? Math.max(0.76, screenSaturation * 0.94) : screenSaturation;
    context.filter = [
      `brightness(${brightness})`,
      `contrast(${contrast})`,
      `saturate(${saturation})`,
      `sepia(${toneProfile.sepia * intensity})`,
      `blur(${Math.max(0.12, width / A3_WIDTH) * 0.62}px)`,
    ].join(" ");
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    context.filter = "none";

    context.save();
    context.globalCompositeOperation = "screen";
    context.globalAlpha = 0.035 + intensity * 0.045;
    context.filter = [
      "brightness(0.62)",
      "contrast(1.18)",
      "saturate(0.42)",
      "hue-rotate(168deg)",
      `blur(${Math.max(0.35, width / A3_WIDTH) * 1.25}px)`,
    ].join(" ");
    const ghostExposure = width * 0.006;
    context.drawImage(
      image,
      rect.x + ghostExposure,
      rect.y - ghostExposure * 0.45,
      rect.width,
      rect.height,
    );
    context.restore();
  }

  if (outputProfile === "print") {
    context.globalCompositeOperation = "screen";
    context.fillStyle = "rgba(203, 216, 222, 0.065)";
    context.fillRect(0, 0, width, height);
  }

  const warmWash = context.createLinearGradient(0, 0, width, height);
  warmWash.addColorStop(
    0,
    `rgba(90, 79, 61, ${0.035 + controls.intensity / 2200 + toneProfile.warmth * (outputProfile === "print" ? 0.35 : 1)})`,
  );
  warmWash.addColorStop(0.55, "rgba(18, 20, 17, .07)");
  warmWash.addColorStop(1, "rgba(2, 4, 4, .16)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = warmWash;
  context.fillRect(0, 0, width, height);

  context.globalCompositeOperation = "source-over";
  context.save();
  context.translate(width * 0.5, height * 0.43);
  context.scale(1, 1.28);
  const subjectFalloff = context.createRadialGradient(
    0,
    0,
    width * 0.17,
    0,
    0,
    width * 0.78,
  );
  subjectFalloff.addColorStop(0, "rgba(0, 0, 0, 0)");
  subjectFalloff.addColorStop(0.44, "rgba(0, 0, 0, 0)");
  const printVignette = outputProfile === "print" ? 0.62 : 1;
  subjectFalloff.addColorStop(0.66, `rgba(0, 0, 0, ${(0.22 + controls.vignette / 900) * printVignette})`);
  subjectFalloff.addColorStop(1, `rgba(0, 0, 0, ${(0.5 + controls.vignette / 225) * printVignette})`);
  context.fillStyle = subjectFalloff;
  context.fillRect(-width, -height, width * 2, height * 2);
  context.restore();

  if (image) {
    const handLightStrength = (0.065 + (controls.intensity / 100) * 0.045) * (outputProfile === "print" ? 1.55 : 1);
    const paintHandLight = (centerX: number, centerY: number) => {
      context.save();
      context.translate(width * centerX, height * centerY);
      context.scale(1, 1.22);
      context.globalCompositeOperation = "screen";
      const handLight = context.createRadialGradient(
        0,
        0,
        width * 0.015,
        0,
        0,
        width * 0.19,
      );
      handLight.addColorStop(0, `rgba(226, 211, 188, ${handLightStrength})`);
      handLight.addColorStop(0.42, `rgba(177, 112, 91, ${handLightStrength * 0.72})`);
      handLight.addColorStop(0.74, `rgba(126, 35, 31, ${handLightStrength * 0.34})`);
      handLight.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = handLight;
      context.beginPath();
      context.arc(0, 0, width * 0.2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    };
    paintHandLight(0.29, 0.61);
    paintHandLight(0.71, 0.61);
  }

  context.save();
  if (brandArt) {
    // The photographed title is pre-extracted to real transparency so its
    // analogue glow remains without carrying a rectangular poster crop.
    const targetWidth = width * 0.72;
    const targetHeight = height * 0.118;
    const targetX = (width - targetWidth) / 2;
    const targetY = height * 0.852;
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 0.98;
    context.filter = `blur(${Math.max(0.2, width / A3_WIDTH) * 0.36}px)`;
    context.drawImage(
      brandArt,
      targetX,
      targetY,
      targetWidth,
      targetHeight,
    );
  } else {
    const titleY = height * 0.922;
    const fontSize = fitTitle(context, width, height);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${fontSize}px Anton, Impact, sans-serif`;
    context.translate(width * 0.5, 0);
    context.scale(0.965, 1);
    context.shadowColor = "rgba(117, 16, 12, .38)";
    context.shadowBlur = fontSize * 0.05;
    context.fillStyle = "#d92f26";
    context.filter = `blur(${fontSize * 0.022}px)`;
    context.fillText("OBSESSION", 0, titleY);
  }
  context.filter = "none";
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.restore();

  const printGrain = outputProfile === "print" ? controls.grain * 0.66 : controls.grain;
  const noiseSize = width > 1000 ? 280 : 120;
  const noise = seededNoise(noiseSize, 32 + printGrain * 0.9);
  const pattern = context.createPattern(noise, "repeat");
  if (pattern) {
    context.globalCompositeOperation = "soft-light";
    context.globalAlpha = 0.2 + printGrain / 260;
    context.fillStyle = pattern;
    context.fillRect(0, 0, width, height);
  }

  context.globalCompositeOperation = "source-over";
  context.globalAlpha = 1;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

async function addPngDpi(blob: Blob, dpi: number) {
  const source = new Uint8Array(await blob.arrayBuffer());
  const signatureLength = 8;
  const ihdrChunkLength = 25;
  const insertionPoint = signatureLength + ihdrChunkLength;
  const pixelsPerMeter = Math.round(dpi / 0.0254);
  const type = new TextEncoder().encode("pHYs");
  const data = new Uint8Array(9);
  const dataView = new DataView(data.buffer);
  dataView.setUint32(0, pixelsPerMeter);
  dataView.setUint32(4, pixelsPerMeter);
  data[8] = 1;

  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, type.length);
  const chunk = new Uint8Array(4 + type.length + data.length + 4);
  const chunkView = new DataView(chunk.buffer);
  chunkView.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  chunkView.setUint32(17, crc32(crcInput));

  const output = new Uint8Array(source.length + chunk.length);
  output.set(source.slice(0, insertionPoint), 0);
  output.set(chunk, insertionPoint);
  output.set(source.slice(insertionPoint), insertionPoint + chunk.length);
  return new Blob([output], { type: "image/png" });
}

function joinBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

async function createA4Pdf(jpeg: Blob) {
  const encoder = new TextEncoder();
  const image = new Uint8Array(await jpeg.arrayBuffer());
  const pageWidth = 595.276;
  const pageHeight = 841.89;
  const content = encoder.encode(`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`);
  const objects: Uint8Array[] = [
    encoder.encode("<< /Type /Catalog /Pages 2 0 R >>"),
    encoder.encode("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
    joinBytes([
      encoder.encode(`<< /Length ${content.length} >>\nstream\n`),
      content,
      encoder.encode("endstream"),
    ]),
    joinBytes([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${A4_WIDTH} /Height ${A4_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`),
      image,
      encoder.encode("\nendstream"),
    ]),
  ];

  const parts: Uint8Array[] = [encoder.encode("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n")];
  const offsets = [0];
  let byteOffset = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(byteOffset);
    const wrapped = joinBytes([
      encoder.encode(`${index + 1} 0 obj\n`),
      object,
      encoder.encode("\nendobj\n"),
    ]);
    parts.push(wrapped);
    byteOffset += wrapped.length;
  });

  const xrefOffset = byteOffset;
  const xref = ["xref", `0 ${objects.length + 1}`, "0000000000 65535 f "];
  for (let index = 1; index <= objects.length; index += 1) {
    xref.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  }
  xref.push(
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF",
  );
  parts.push(encoder.encode(`${xref.join("\n")}\n`));
  return new Blob([joinBytes(parts)], { type: "application/pdf" });
}

const Control = ({
  label,
  value,
  min,
  max,
  suffix = "%",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) => (
  <label className="control">
    <span>
      {label}
      <output>
        {value}
        {suffix}
      </output>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  </label>
);

const HandGuide = ({ side }: { side: "left" | "right" }) => (
  <div className={`guide-hand guide-hand-${side}`}>
    <i className="hand-palm" />
    <i className="hand-finger finger-one" />
    <i className="hand-finger finger-two" />
    <i className="hand-finger finger-three" />
    <i className="hand-finger finger-four" />
    <i className="hand-thumb" />
  </div>
);

export default function ObsessionPoster() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const brandArtRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const poseInitRef = useRef<Promise<PoseLandmarkerLike> | null>(null);
  const latestPoseRef = useRef<PoseLandmark[] | null>(null);
  const poseFrameRef = useRef<number | null>(null);
  const lastPoseVideoTimeRef = useRef(-1);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageLoadIdRef = useRef(0);
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [toneProfile, setToneProfile] = useState(DEFAULT_TONE_PROFILE);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("还没拍。照片不会离开你的手机。");
  const [quality, setQuality] = useState<{ tone: string; label: string }>({
    tone: "waiting",
    label: "等待原图",
  });
  const [exporting, setExporting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [poseFeedback, setPoseFeedback] = useState<PoseFeedback>({
    tone: "loading",
    label: "AI 正在准备…",
    score: 0,
  });
  const [timerSeconds, setTimerSeconds] = useState<TimerSeconds>(3);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [aiAdjusted, setAiAdjusted] = useState(false);
  const [fontReady, setFontReady] = useState(false);
  const [brandReady, setBrandReady] = useState(false);
  const [experienceEntered, setExperienceEntered] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<OutputProfile>("screen");
  const [outputAction, setOutputAction] = useState<"download" | "print-png" | "pdf" | "print" | "share" | null>(null);

  const updateControl = useCallback((key: keyof Controls, value: number) => {
    setControls((current) => ({ ...current, [key]: value }));
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    renderPoster(
      canvasRef.current,
      PREVIEW_WIDTH,
      PREVIEW_HEIGHT,
      imageRef.current,
      controls,
      toneProfile,
      brandArtRef.current,
      previewProfile,
    );
  }, [brandReady, controls, fileName, fontReady, previewProfile, toneProfile]);

  useEffect(() => {
    void document.fonts.load('96px "Anton"').then(() => setFontReady(true));
    const brandArt = new Image();
    brandArt.decoding = "async";
    brandArt.onload = () => {
      brandArtRef.current = brandArt;
      setBrandReady(true);
    };
    brandArt.src = "./obsession-title.png";
    let enteredFrame: number | null = null;
    if (window.sessionStorage.getItem("obsession-entered") === "yes") {
      enteredFrame = window.requestAnimationFrame(() => setExperienceEntered(true));
    }
    return () => {
      if (enteredFrame !== null) window.cancelAnimationFrame(enteredFrame);
      brandArt.onload = null;
    };
  }, []);

  const clearCountdown = useCallback(() => {
    if (countdownTimeoutRef.current) {
      clearTimeout(countdownTimeoutRef.current);
      countdownTimeoutRef.current = null;
    }
    setCountdown(null);
  }, []);

  const closeCamera = useCallback(() => {
    clearCountdown();
    setCameraOpen(false);
  }, [clearCountdown]);

  const ensurePoseLandmarker = useCallback(() => {
    if (poseLandmarkerRef.current) return Promise.resolve(poseLandmarkerRef.current);
    if (poseInitRef.current) return poseInitRef.current;

    poseInitRef.current = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks("./mediapipe/wasm");
      const options = {
        baseOptions: {
          modelAssetPath: "./models/pose_landmarker_lite.task",
          delegate: "GPU" as const,
        },
        runningMode: "VIDEO" as const,
        numPoses: 1,
        minPoseDetectionConfidence: 0.48,
        minPosePresenceConfidence: 0.48,
        minTrackingConfidence: 0.45,
      };

      let landmarker;
      try {
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, options);
      } catch {
        landmarker = await vision.PoseLandmarker.createFromOptions(fileset, {
          ...options,
          baseOptions: { ...options.baseOptions, delegate: "CPU" },
        });
      }
      poseLandmarkerRef.current = landmarker as unknown as PoseLandmarkerLike;
      return poseLandmarkerRef.current;
    })().catch((error) => {
      poseInitRef.current = null;
      throw error;
    });

    return poseInitRef.current;
  }, []);

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    document.body.style.overflow = "hidden";

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };

    const startCamera = async () => {
      stopStream();
      setCameraReady(false);
      setCameraError("");
      latestPoseRef.current = null;
      setPoseFeedback({ tone: "loading", label: "AI 正在准备…", score: 0 });
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("当前浏览器不支持实时取景，请使用系统高清相机。");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: cameraFacing },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch {
        setCameraError("相机没有打开。请允许相机权限，或改用系统高清相机。");
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      stopStream();
      document.body.style.overflow = "";
    };
  }, [cameraOpen, cameraFacing]);

  useEffect(() => {
    if (!cameraOpen || !cameraReady) return;
    let cancelled = false;
    let lastAnalysis = 0;

    const startPoseGuide = async () => {
      try {
        const landmarker = await ensurePoseLandmarker();
        if (cancelled) return;

        const analyze = (now: number) => {
          if (cancelled) return;
          const video = videoRef.current;
          if (
            video &&
            video.readyState >= 2 &&
            video.videoWidth > 0 &&
            now - lastAnalysis >= 320 &&
            video.currentTime !== lastPoseVideoTimeRef.current
          ) {
            lastAnalysis = now;
            lastPoseVideoTimeRef.current = video.currentTime;
            try {
              const result = landmarker.detectForVideo(video, now);
              const rawPose = result.landmarks[0];
              if (rawPose) {
                const mappedPose = mapPoseToPoster(
                  rawPose,
                  video.videoWidth,
                  video.videoHeight,
                  cameraFacing === "user",
                );
                latestPoseRef.current = mappedPose;
                setPoseFeedback(evaluatePose(mappedPose));
              } else {
                latestPoseRef.current = null;
                setPoseFeedback({
                  tone: "missing",
                  label: "往后一点，让肩膀和双手入镜",
                  score: 0,
                });
              }
            } catch {
              setPoseFeedback({ tone: "missing", label: "按参考线站位即可", score: 0 });
            }
          }
          poseFrameRef.current = requestAnimationFrame(analyze);
        };

        poseFrameRef.current = requestAnimationFrame(analyze);
      } catch {
        if (!cancelled) {
          setPoseFeedback({ tone: "missing", label: "按参考线站位即可", score: 0 });
        }
      }
    };

    void startPoseGuide();
    return () => {
      cancelled = true;
      if (poseFrameRef.current !== null) {
        cancelAnimationFrame(poseFrameRef.current);
        poseFrameRef.current = null;
      }
    };
  }, [cameraFacing, cameraOpen, cameraReady, ensurePoseLandmarker]);

  useEffect(() => () => {
    if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
    poseLandmarkerRef.current?.close();
  }, []);

  const autoAlign = useCallback(async (image: HTMLImageElement) => {
    const Detector = (window as typeof window & { FaceDetector?: FaceDetectorConstructor })
      .FaceDetector;
    if (!Detector) {
      setStatus("已按原版计算色调。可拖动画面或用滑杆微调人物位置。");
      return;
    }

    try {
      const detector = new Detector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(image);
      if (!faces.length) {
        setStatus("已按原版计算整张照片的色调，并保留居中构图。");
        return;
      }
      const face = faces[0].boundingBox;
      const faceCenterY = (face.y + face.height / 2) / image.naturalHeight;
      const suggestedOffset = clamp((0.22 - faceCenterY) * 160, -70, 70);
      setControls((current) => ({ ...current, offsetY: Math.round(suggestedOffset) }));
      setStatus("已对齐人物，整张照片的色调也已按原版重算。");
    } catch {
      setStatus("已按原版计算色调。可拖动画面或用滑杆微调人物位置。");
    }
  }, []);

  const loadFile = useCallback(
    async (file: File, poseForAdjustment?: PoseLandmark[] | null) => {
      if (!file.type.startsWith("image/")) {
        setStatus("请选择 JPG、PNG 或 WebP 图片。");
        return;
      }
      if (file.size > 45 * 1024 * 1024) {
        setStatus("图片超过 45 MB，请先压缩后重试。");
        return;
      }

      const loadId = ++imageLoadIdRef.current;
      setStatus("正在安全处理照片……");
      try {
        const prepared = await prepareWorkingImage(file);
        if (loadId !== imageLoadIdRef.current) return;
        const image = await imageFromBlob(prepared.blob);
        if (loadId !== imageLoadIdRef.current) return;
        imageRef.current = image;
        setToneProfile(analyzeImageTone(image));
        setFileName(file.name);
        const aiControls = poseForAdjustment
          ? controlsFromPose(poseForAdjustment)
          : null;
        setControls(aiControls ?? DEFAULT_CONTROLS);
        setAiAdjusted(Boolean(aiControls));
        const sourceWidth = prepared.dimensions?.width ?? image.naturalWidth;
        const sourceHeight = prepared.dimensions?.height ?? image.naturalHeight;
        const megapixels = (sourceWidth * sourceHeight) / 1_000_000;
        if (megapixels >= 16 && Math.max(sourceWidth, sourceHeight) >= 4800) {
          setQuality({ tone: "excellent", label: `原图 ${megapixels.toFixed(1)}MP · A3 优秀` });
        } else if (megapixels >= 10) {
          setQuality({ tone: "good", label: `原图 ${megapixels.toFixed(1)}MP · A3 可用` });
        } else {
          setQuality({ tone: "low", label: `原图 ${megapixels.toFixed(1)}MP · 建议换高清图` });
        }
        if (aiControls) {
          setStatus("人物位置已校正，整张照片的色调也已按原版重算。");
        } else {
          setStatus(
            prepared.reduced
              ? "照片已安全优化，正在检查人物位置……"
              : "照片已载入，正在检查人物位置……",
          );
          void autoAlign(image);
        }
      } catch (error) {
        if (loadId !== imageLoadIdRef.current) return;
        if (
          error instanceof Error &&
          (error.message === "Unsupported image metadata" ||
            error.message === "Large image resize unsupported")
        ) {
          setStatus("为避免页面崩溃，请把这张照片转成 JPG 后再选一次。");
        } else {
          setStatus("这张图片无法读取，请换一张试试。");
        }
      }
    },
    [autoAlign],
  );

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadFile(file);
  };

  const capturePhotoNow = useCallback(() => {
    const video = videoRef.current;
    if (!video || !cameraReady || !video.videoWidth || !video.videoHeight) {
      setCameraError("相机还在准备，请稍等一秒再拍。");
      return;
    }

    const targetRatio = A3_WIDTH / A3_HEIGHT;
    const sourceRatio = video.videoWidth / video.videoHeight;
    let sourceX = 0;
    let sourceY = 0;
    let sourceWidth = video.videoWidth;
    let sourceHeight = video.videoHeight;

    if (sourceRatio > targetRatio) {
      sourceWidth = video.videoHeight * targetRatio;
      sourceX = (video.videoWidth - sourceWidth) / 2;
    } else {
      sourceHeight = video.videoWidth / targetRatio;
      sourceY = (video.videoHeight - sourceHeight) / 2;
    }

    const captureCanvas = document.createElement("canvas");
    captureCanvas.width = Math.max(1, Math.floor(sourceWidth));
    captureCanvas.height = Math.max(1, Math.floor(sourceHeight));
    const context = captureCanvas.getContext("2d");
    if (!context) return;
    const capturedPose = latestPoseRef.current;

    if (cameraFacing === "user") {
      context.translate(captureCanvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      captureCanvas.width,
      captureCanvas.height,
    );
    captureCanvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("照片没有保存成功，请再拍一次。");
          return;
        }
        void loadFile(
          new File([blob], `obsession-camera-${Date.now()}.jpg`, { type: "image/jpeg" }),
          capturedPose,
        );
        closeCamera();
      },
      "image/jpeg",
      0.96,
    );
  }, [cameraFacing, cameraReady, closeCamera, loadFile]);

  const startTimedCapture = useCallback(() => {
    if (countdown !== null) {
      clearCountdown();
      return;
    }
    if (timerSeconds === 0) {
      capturePhotoNow();
      return;
    }

    let remaining = timerSeconds;
    setCountdown(remaining);
    navigator.vibrate?.(35);

    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) {
        countdownTimeoutRef.current = null;
        setCountdown(null);
        navigator.vibrate?.(70);
        capturePhotoNow();
        return;
      }
      setCountdown(remaining);
      navigator.vibrate?.(35);
      countdownTimeoutRef.current = setTimeout(tick, 1000);
    };

    countdownTimeoutRef.current = setTimeout(tick, 1000);
  }, [capturePhotoNow, clearCountdown, countdown, timerSeconds]);

  const renderPosterFile = async (
    width: number,
    height: number,
    profile: OutputProfile,
    type: "image/png" | "image/jpeg" = "image/png",
  ) => {
    await document.fonts.load('256px "Anton"');
    const exportCanvas = document.createElement("canvas");
    renderPoster(
      exportCanvas,
      width,
      height,
      imageRef.current,
      controls,
      toneProfile,
      brandArtRef.current,
      profile,
    );
    const rawBlob = await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
        type,
        type === "image/jpeg" ? 0.98 : undefined,
      );
    });
    exportCanvas.width = 1;
    exportCanvas.height = 1;
    return type === "image/png" ? addPngDpi(rawBlob, 300) : rawBlob;
  };

  const renderA3Poster = () => renderPosterFile(A3_WIDTH, A3_HEIGHT, "screen");
  const renderA4PrintPoster = () => renderPosterFile(A4_WIDTH, A4_HEIGHT, "print");
  const renderA4PrintPdf = async () => {
    const jpeg = await renderPosterFile(A4_WIDTH, A4_HEIGHT, "print", "image/jpeg");
    return createA4Pdf(jpeg);
  };

  const downloadPosterBlob = (blob: Blob, fileName: string) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const exportPoster = async () => {
    if (!imageRef.current) {
      setStatus("请先上传人物照片，再导出正式海报。");
      fileInputRef.current?.click();
      return;
    }

    setExporting(true);
    setOutputAction("download");
    setStatus("正在渲染 A3 300 DPI 海报，请稍候……");
    await new Promise((resolve) => window.setTimeout(resolve, 40));

    try {
      const printBlob = await renderA3Poster();
      downloadPosterBlob(printBlob, "obsession-a3-screen-300dpi.png");
      setStatus("导出完成：3508 × 4961 px，A3 300 DPI，已保留 OBSESSION 标识。");
    } catch {
      setStatus("导出没有完成，请换用 Chrome 或 Edge 后重试。");
    } finally {
      setExporting(false);
      setOutputAction(null);
    }
  };

  const exportA4PrintPng = async () => {
    if (!imageRef.current) {
      setStatus("请先上传人物照片，再生成 A4 打印版。");
      fileInputRef.current?.click();
      return;
    }
    setExporting(true);
    setOutputAction("print-png");
    setStatus("正在生成提亮暗部的 A4 300 DPI 打印版……");
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    try {
      const blob = await renderA4PrintPoster();
      downloadPosterBlob(blob, "obsession-a4-print-300dpi.png");
      setStatus("A4 打印版已保存：2480 × 3508 px，人物暗部已做纸面补偿。");
    } catch {
      setStatus("A4 打印版没有生成，请关闭其他图片页面后重试。");
    } finally {
      setExporting(false);
      setOutputAction(null);
    }
  };

  const exportA4Pdf = async () => {
    if (!imageRef.current) {
      setStatus("请先上传人物照片，再生成 A4 PDF。");
      fileInputRef.current?.click();
      return;
    }
    setExporting(true);
    setOutputAction("pdf");
    setStatus("正在制作标准 A4 打印 PDF……");
    await new Promise((resolve) => window.setTimeout(resolve, 40));
    try {
      const blob = await renderA4PrintPdf();
      downloadPosterBlob(blob, "obsession-a4-print-300dpi.pdf");
      setStatus("标准 A4 PDF 已保存，可直接在 Canon 打印软件中按实际尺寸打印。");
    } catch {
      setStatus("PDF 没有生成，请改用 A4 打印 PNG。");
    } finally {
      setExporting(false);
      setOutputAction(null);
    }
  };

  const printPoster = async () => {
    if (!imageRef.current) {
      setStatus("先拍一张照片，再把正式海报送去打印。");
      setCameraOpen(true);
      return;
    }

    const printWindow = window.open("", "obsession-a4-print");
    if (!printWindow) {
      setStatus("手机拦截了打印窗口，请允许弹窗后再试。");
      return;
    }
    printWindow.document.write("<!doctype html><title>正在准备 A4 打印版…</title><body style='margin:0;background:#050505'></body>");
    printWindow.document.close();
    setExporting(true);
    setOutputAction("print");
    setStatus("正在打开手机打印面板……");

    try {
      const printBlob = await renderA4PrintPoster();
      const printUrl = URL.createObjectURL(printBlob);
      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
        <html lang="zh-CN"><head><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>OBSESSION · A4 PRINT</title><style>
        @page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{width:210mm;height:297mm;margin:0;background:#000;overflow:hidden}
        img{display:block;width:210mm;height:297mm;object-fit:fill}
        @media screen{body{width:100vw;height:auto;min-height:100vh;display:grid;place-items:center}img{width:min(100vw,707px);height:auto}}
        </style></head><body><img id="poster" src="${printUrl}" alt="Obsession A4 print poster"></body></html>`);
      printWindow.document.close();
      const printImage = printWindow.document.getElementById("poster") as HTMLImageElement | null;
      const openPrintPanel = () => {
        printWindow.focus();
        printWindow.print();
        window.setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);
      };
      if (printImage?.complete) openPrintPanel();
      else printImage?.addEventListener("load", openPrintPanel, { once: true });
      setStatus("A4 打印版已打开：介质选哑光照片纸、质量选高、缩放选 100% / 实际尺寸。");
    } catch {
      printWindow.close();
      setStatus("打印面板没有打开，请先下载 PNG，再从相册打印。");
    } finally {
      setExporting(false);
      setOutputAction(null);
    }
  };

  const sharePoster = async () => {
    if (!imageRef.current) {
      setStatus("先拍一张照片，再发送到打印 App。");
      setCameraOpen(true);
      return;
    }
    setExporting(true);
    setOutputAction("share");
    setStatus("正在准备 A4 打印文件……");
    try {
      const printBlob = await renderA4PrintPoster();
      const file = new File([printBlob], "obsession-a4-print-300dpi.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ files: [file], title: "OBSESSION · A4 PRINT POSTER" });
        setStatus("海报已经交给手机系统，可选择打印机 App 或附近设备。");
      } else {
        downloadPosterBlob(printBlob, "obsession-a4-print-300dpi.png");
        setStatus("当前浏览器不支持文件分享，已改为下载 A4 打印 PNG。");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("已取消发送，海报仍留在你的手机里。");
      } else {
        setStatus("发送没有完成，请改用下载 A4 打印 PNG。");
      }
    } finally {
      setExporting(false);
      setOutputAction(null);
    }
  };

  const enterExperience = () => {
    window.sessionStorage.setItem("obsession-entered", "yes");
    setExperienceEntered(true);
  };

  return (
    <main className="obsession-experience">
      <section
        className={`experience-gate ${experienceEntered ? "experience-gate-open" : ""}`}
        aria-hidden={experienceEntered}
      >
        <div className="gate-ghost" aria-hidden="true">OBSESSION</div>
        <button onClick={enterExperience} tabIndex={experienceEntered ? -1 : 0}>
          <span>FILM 01 / CAMERA RITUAL</span>
          <strong>BEGIN</strong>
          <small>ENTER THE OBSESSION PORTRAIT</small>
        </button>
      </section>

      <header className="topbar">
        <div className="film-brand">
          <a className="site-back" href="../" aria-label="返回 Cosmos Film 42 主页">
            <img
              className="site-back-logo"
              src="./cosmos-film42-logo.png"
              width={595}
              height={472}
              alt="宇宙戏映"
            />
          </a>
          <a className="wordmark" href="#booth" aria-label="Obsession 拍照亭顶部">
            OBSESSION
          </a>
        </div>
        <div className="privacy-pill"><i /> PRIVATE ON DEVICE</div>
      </header>

      <section className="hero" id="booth">
        <div className="hero-atmosphere" aria-hidden="true">
          <img src="./original-poster.png" alt="" />
        </div>
        <div className="hero-copy">
          <p className="eyebrow">OBSESSION / CAMERA RITUAL 01</p>
          <h1>BECOME<br /><em>THE POSTER.</em></h1>
          <p className="intro">花挡住脸。双手抱紧。别动。<br />现在，轮到你进入画面。</p>
          <div className="capture-actions">
            <button className="upload-hero" onClick={() => setCameraOpen(true)}>
              <span>进入相机</span>
              <small>站进参考线，拍下</small>
            </button>
            <button className="album-button" onClick={() => fileInputRef.current?.click()}>
              上传照片
            </button>
          </div>
          <input
            ref={cameraInputRef}
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
          />
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFile}
          />
          <p className="status" aria-live="polite">{status}</p>
        </div>

        <div className="poster-stage">
          <div className="live-preview-label">
            <span>LIVE PREVIEW</span>
            <small>{fileName ? (previewProfile === "print" ? "A4 打印补偿" : "屏幕电影版") : "原版构图"}</small>
          </div>
          <div className="poster-frame">
            <canvas
              ref={canvasRef}
              className={!fileName ? "poster-canvas-hidden" : ""}
              aria-label="Obsession 海报实时预览"
            />
            {!fileName && (
              <img
                className="poster-original-preview"
                src="./original-poster.png"
                width={795}
                height={1194}
                decoding="async"
                alt="原版 Obsession 海报构图参考"
              />
            )}
          </div>
          <div className="preview-profile-switch" role="group" aria-label="海报预览版本">
            <button
              className={previewProfile === "screen" ? "is-active" : ""}
              onClick={() => setPreviewProfile("screen")}
              type="button"
            >
              屏幕版
            </button>
            <button
              className={previewProfile === "print" ? "is-active" : ""}
              onClick={() => setPreviewProfile("print")}
              type="button"
            >
              A4 打印版
            </button>
          </div>
          <div className="poster-meta">
            <span>{previewProfile === "print" ? "A4 PRINT" : "A3 SCREEN"}</span>
            <span>{previewProfile === "print" ? "2480 × 3508 PX" : "3508 × 4961 PX"}</span>
            <span>300 DPI</span>
          </div>
          <div className={`quality-badge quality-${quality.tone}`}>{quality.label}</div>
          {aiAdjusted && <div className="ai-adjusted-badge">AI 已校正构图</div>}
        </div>
      </section>

      <section className="workbench">
        <div className="controls-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DARKROOM / 02</p>
              <h2>CONTROL<br />THE DARK.</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setControls(DEFAULT_CONTROLS)}
            >
              还原
            </button>
          </div>
          <div className="control-grid">
            <Control label="滤镜强度" value={controls.intensity} min={35} max={100} onChange={(value) => updateControl("intensity", value)} />
            <Control label="胶片颗粒" value={controls.grain} min={0} max={100} onChange={(value) => updateControl("grain", value)} />
            <Control label="暗角" value={controls.vignette} min={20} max={100} onChange={(value) => updateControl("vignette", value)} />
            <Control label="人物大小" value={controls.scale} min={100} max={150} onChange={(value) => updateControl("scale", value)} />
            <Control label="左右位置" value={controls.offsetX} min={-100} max={100} suffix="" onChange={(value) => updateControl("offsetX", value)} />
            <Control label="上下位置" value={controls.offsetY} min={-100} max={100} suffix="" onChange={(value) => updateControl("offsetY", value)} />
          </div>
          <p className="drag-tip">用人物大小、左右位置和上下位置调整构图。</p>
        </div>

        <aside className="export-panel">
          <p className="eyebrow">PRINT ROOM / 03</p>
          <h2>MAKE IT<br />PHYSICAL.</h2>
          <ul>
            <li><strong>设备</strong><span>Canon TR160</span></li>
            <li><strong>尺寸</strong><span>A4 纵向</span></li>
            <li><strong>像素</strong><span>2480 × 3508</span></li>
            <li><strong>精度</strong><span>300 DPI</span></li>
            <li><strong>色调</strong><span>纸面暗部补偿</span></li>
          </ul>
          <div className="output-actions">
            <button className="print-button" onClick={printPoster} disabled={exporting}>
              {outputAction === "print" ? "正在打开打印…" : "直接打印 A4"}
            </button>
            <div className="primary-downloads">
              <button className="export-button" onClick={exportA4PrintPng} disabled={exporting}>
                {outputAction === "print-png" ? "补偿中…" : "保存 A4 PNG"}
              </button>
              <button className="pdf-button" onClick={exportA4Pdf} disabled={exporting}>
                {outputAction === "pdf" ? "制作中…" : "下载 A4 PDF"}
              </button>
            </div>
            <div className="secondary-downloads">
              <button className="export-button" onClick={exportPoster} disabled={exporting}>
                {outputAction === "download" ? "显影中…" : "保存 A3 屏幕版"}
              </button>
              <button className="share-button" onClick={sharePoster} disabled={exporting}>
                {outputAction === "share" ? "准备中…" : "发送到打印 App"}
              </button>
            </div>
          </div>
          <p className="export-note">A4 打印版会自动提亮人物暗部并减弱棕红偏色；屏幕版仍保留原来的极暗电影质感。打印时选“哑光照片纸 / 高质量 / 实际尺寸”。</p>
        </aside>
      </section>

      <section className="shoot-guide" aria-label="拍摄准备">
        <div className="rule"><span>01 / FACE</span><strong>花挡住脸</strong></div>
        <div className="rule"><span>02 / HANDS</span><strong>双手抱紧</strong></div>
        <div className="rule"><span>03 / LIGHT</span><strong>人物迎着光</strong></div>
      </section>

      <footer>
        <span>OBSESSION</span>
        <p>PHOTO BOOTH / PRINT A3</p>
      </footer>

      {cameraOpen && (
        <section className="camera-overlay" role="dialog" aria-modal="true" aria-label="带站位线拍摄">
          <header className="camera-header">
            <span>OBSESSION</span>
            <button aria-label="关闭相机" onClick={closeCamera}>×</button>
          </header>

          <div className="camera-viewport">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cameraFacing === "user" ? "camera-mirrored" : ""}
            />
            <div className={`composition-guide ${poseFeedback.tone === "good" ? "guide-good" : ""}`} aria-hidden="true">
              <div className="guide-bouquet" />
              <div className="guide-face" />
              <div className="guide-vase"><i /></div>
              <HandGuide side="left" />
              <HandGuide side="right" />
              <div className="guide-title">OBSESSION</div>
              <i className="corner corner-tl" />
              <i className="corner corner-tr" />
              <i className="corner corner-bl" />
              <i className="corner corner-br" />
            </div>
            {cameraReady && !cameraError && (
              <div
                className={`pose-feedback pose-feedback-${poseFeedback.tone}`}
                role="status"
                aria-live="polite"
                aria-label={`AI 站位检测：${poseFeedback.label}`}
              >
                <i />
                <span>{poseFeedback.label}</span>
              </div>
            )}
            {countdown !== null && (
              <button
                className="camera-countdown"
                aria-label="取消倒计时"
                onClick={clearCountdown}
              >
                {countdown}
              </button>
            )}
            {!cameraReady && !cameraError && <div className="camera-message">正在打开相机…</div>}
            {cameraError && <div className="camera-message camera-error">{cameraError}</div>}
          </div>

          <div className="camera-bottom">
            <div className="timer-options" role="group" aria-label="定时拍照">
              {([0, 3, 10] as TimerSeconds[]).map((seconds) => (
                <button
                  key={seconds}
                  className={timerSeconds === seconds ? "timer-active" : ""}
                  aria-pressed={timerSeconds === seconds}
                  disabled={countdown !== null}
                  onClick={() => setTimerSeconds(seconds)}
                >
                  {seconds === 0 ? "立即" : `${seconds} 秒`}
                </button>
              ))}
            </div>
            <div className="camera-controls">
              <button
                className="camera-secondary"
                disabled={countdown !== null}
                onClick={() => setCameraFacing((current) => current === "environment" ? "user" : "environment")}
              >
                翻转
              </button>
              <button
                className={`shutter ${countdown !== null ? "shutter-counting" : ""}`}
                aria-label={countdown !== null ? "取消倒计时" : "拍摄照片"}
                onClick={startTimedCapture}
              >
                <i />
              </button>
              <button
                className="camera-secondary"
                disabled={countdown !== null}
                onClick={() => cameraInputRef.current?.click()}
              >
                高清相机
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="mobile-capture-bar">
        <button onClick={() => setCameraOpen(true)}>CAMERA</button>
        <button onClick={() => fileInputRef.current?.click()}>UPLOAD</button>
        {fileName && <button onClick={printPoster}>PRINT</button>}
      </div>
    </main>
  );
}
