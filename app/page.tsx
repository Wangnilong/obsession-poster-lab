"use client";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const A3_WIDTH = 3508;
const A3_HEIGHT = 4961;
const PREVIEW_WIDTH = 707;
const PREVIEW_HEIGHT = 1000;

type Controls = {
  intensity: number;
  grain: number;
  vignette: number;
  scale: number;
  offsetX: number;
  offsetY: number;
};

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

function drawDemo(context: CanvasRenderingContext2D, width: number, height: number) {
  const windowGlow = context.createLinearGradient(0, 0, width, height * 0.5);
  windowGlow.addColorStop(0, "#6d6653");
  windowGlow.addColorStop(0.36, "#b29c76");
  windowGlow.addColorStop(0.65, "#6d7065");
  windowGlow.addColorStop(1, "#262824");
  context.fillStyle = windowGlow;
  context.fillRect(0, 0, width, height * 0.54);

  context.fillStyle = "rgba(8, 9, 8, .94)";
  context.beginPath();
  context.ellipse(width * 0.5, height * 0.63, width * 0.54, height * 0.49, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#0a0b0a";
  context.beginPath();
  context.ellipse(width * 0.5, height * 0.25, width * 0.18, height * 0.16, 0, 0, Math.PI * 2);
  context.fill();

  const blooms = [
    [0.37, 0.22, 0.105],
    [0.49, 0.2, 0.12],
    [0.62, 0.23, 0.11],
    [0.43, 0.3, 0.1],
    [0.57, 0.3, 0.095],
  ];
  blooms.forEach(([x, y, radius], index) => {
    const bloom = context.createRadialGradient(
      width * x,
      height * y,
      0,
      width * x,
      height * y,
      width * radius,
    );
    bloom.addColorStop(0, index % 2 ? "#6f2826" : "#4d1719");
    bloom.addColorStop(0.45, "#381416");
    bloom.addColorStop(1, "rgba(10, 8, 8, 0)");
    context.fillStyle = bloom;
    context.beginPath();
    context.arc(width * x, height * y, width * radius, 0, Math.PI * 2);
    context.fill();
  });

  context.strokeStyle = "rgba(177, 72, 61, .32)";
  context.lineWidth = width * 0.028;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(width * 0.31, height * 0.65);
  context.quadraticCurveTo(width * 0.39, height * 0.53, width * 0.48, height * 0.66);
  context.moveTo(width * 0.69, height * 0.65);
  context.quadraticCurveTo(width * 0.61, height * 0.53, width * 0.52, height * 0.66);
  context.stroke();
}

function fitTitle(context: CanvasRenderingContext2D, width: number, height: number) {
  const title = "OBSESSION";
  let fontSize = height * 0.102;
  context.font = `${fontSize}px Anton, Impact, sans-serif`;
  while (context.measureText(title).width > width * 0.79 && fontSize > 16) {
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
    context.filter = [
      `brightness(${0.61 - intensity * 0.1})`,
      `contrast(${1.16 + intensity * 0.42})`,
      `saturate(${0.7 - intensity * 0.31})`,
      `sepia(${0.12 + intensity * 0.24})`,
      `blur(${Math.max(0.15, width / A3_WIDTH) * 0.9}px)`,
    ].join(" ");
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    context.filter = "none";
  } else {
    drawDemo(context, width, height);
  }

  const warmWash = context.createLinearGradient(0, 0, width, height);
  warmWash.addColorStop(0, `rgba(111, 93, 67, ${0.17 + controls.intensity / 900})`);
  warmWash.addColorStop(0.55, "rgba(20, 22, 19, .18)");
  warmWash.addColorStop(1, "rgba(2, 5, 5, .42)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = warmWash;
  context.fillRect(0, 0, width, height);

  context.globalCompositeOperation = "screen";
  const faceGlow = context.createRadialGradient(
    width * 0.5,
    height * 0.3,
    0,
    width * 0.5,
    height * 0.3,
    width * 0.36,
  );
  faceGlow.addColorStop(0, `rgba(192, 34, 26, ${0.16 + controls.intensity / 540})`);
  faceGlow.addColorStop(0.48, "rgba(109, 18, 17, .11)");
  faceGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = faceGlow;
  context.fillRect(0, 0, width, height * 0.68);

  const handGlow = context.createLinearGradient(0, height * 0.43, width, height * 0.78);
  handGlow.addColorStop(0, "rgba(190, 31, 24, .17)");
  handGlow.addColorStop(0.42, "rgba(0, 0, 0, 0)");
  handGlow.addColorStop(0.68, "rgba(0, 0, 0, 0)");
  handGlow.addColorStop(1, "rgba(196, 43, 31, .2)");
  context.fillStyle = handGlow;
  context.fillRect(0, height * 0.36, width, height * 0.46);

  context.globalCompositeOperation = "source-over";
  const vignette = context.createRadialGradient(
    width * 0.5,
    height * 0.42,
    width * 0.12,
    width * 0.5,
    height * 0.43,
    width * 0.78,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(0.65, `rgba(0, 0, 0, ${controls.vignette / 520})`);
  vignette.addColorStop(1, `rgba(0, 0, 0, ${0.55 + controls.vignette / 260})`);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  const titleY = height * 0.928;
  const fontSize = fitTitle(context, width, height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${fontSize}px Anton, Impact, sans-serif`;
  context.save();
  context.translate(width * 0.5, 0);
  context.scale(0.86, 1);
  context.shadowColor = "rgba(255, 45, 31, .9)";
  context.shadowBlur = fontSize * 0.16;
  context.fillStyle = "#ee2c20";
  context.filter = `blur(${fontSize * 0.025}px)`;
  context.fillText("OBSESSION", 0, titleY);
  context.filter = "none";
  context.shadowBlur = 0;
  context.globalAlpha = 0.82;
  context.fillStyle = "#ff3e2d";
  context.fillText("OBSESSION", 0, titleY - fontSize * 0.015);
  context.globalAlpha = 1;
  context.restore();

  const noiseSize = width > 1000 ? 280 : 120;
  const noise = seededNoise(noiseSize, 32 + controls.grain * 0.9);
  const pattern = context.createPattern(noise, "repeat");
  if (pattern) {
    context.globalCompositeOperation = "soft-light";
    context.globalAlpha = 0.2 + controls.grain / 260;
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

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("上传人物照片，首版滤镜会在本机完成处理。");
  const [quality, setQuality] = useState<{ tone: string; label: string }>({
    tone: "waiting",
    label: "等待原图",
  });
  const [exporting, setExporting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [fontReady, setFontReady] = useState(false);

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
    );
  }, [controls, fileName, fontReady]);

  useEffect(() => {
    void document.fonts.load('96px "Anton"').then(() => setFontReady(true));
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

  const autoAlign = useCallback(async (image: HTMLImageElement) => {
    const Detector = (window as typeof window & { FaceDetector?: FaceDetectorConstructor })
      .FaceDetector;
    if (!Detector) {
      setStatus("已使用海报默认构图。可拖动画面或用滑杆微调人物位置。");
      return;
    }

    try {
      const detector = new Detector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await detector.detect(image);
      if (!faces.length) {
        setStatus("未识别人脸（被花遮住也可能发生），已保留居中构图。");
        return;
      }
      const face = faces[0].boundingBox;
      const faceCenterY = (face.y + face.height / 2) / image.naturalHeight;
      const suggestedOffset = clamp((0.3 - faceCenterY) * 160, -70, 70);
      setControls((current) => ({ ...current, offsetY: Math.round(suggestedOffset) }));
      setStatus("已识别人脸并自动对齐到海报视觉中心。");
    } catch {
      setStatus("已使用海报默认构图。可拖动画面或用滑杆微调人物位置。");
    }
  }, []);

  const loadFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        setStatus("请选择 JPG、PNG 或 WebP 图片。");
        return;
      }
      if (file.size > 45 * 1024 * 1024) {
        setStatus("图片超过 45 MB，请先压缩后重试。");
        return;
      }

      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        imageRef.current = image;
        setFileName(file.name);
        setControls(DEFAULT_CONTROLS);
        const megapixels = (image.naturalWidth * image.naturalHeight) / 1_000_000;
        if (megapixels >= 16 && Math.max(image.naturalWidth, image.naturalHeight) >= 4800) {
          setQuality({ tone: "excellent", label: `原图 ${megapixels.toFixed(1)}MP · A3 优秀` });
        } else if (megapixels >= 10) {
          setQuality({ tone: "good", label: `原图 ${megapixels.toFixed(1)}MP · A3 可用` });
        } else {
          setQuality({ tone: "low", label: `原图 ${megapixels.toFixed(1)}MP · 建议换高清图` });
        }
        setStatus("照片已载入，正在检查人物位置……");
        void autoAlign(image);
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        setStatus("这张图片无法读取，请换一张试试。");
        URL.revokeObjectURL(url);
      };
      image.src = url;
    },
    [autoAlign],
  );

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadFile(file);
  };

  const captureGuidedPhoto = () => {
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
        loadFile(new File([blob], `obsession-camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
        setCameraOpen(false);
      },
      "image/jpeg",
      0.96,
    );
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!imageRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: controls.offsetX,
      offsetY: controls.offsetY,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = ((event.clientX - dragRef.current.x) / rect.width) * 160;
    const dy = ((event.clientY - dragRef.current.y) / rect.height) * 160;
    setControls((current) => ({
      ...current,
      offsetX: clamp(Math.round(dragRef.current!.offsetX + dx), -100, 100),
      offsetY: clamp(Math.round(dragRef.current!.offsetY + dy), -100, 100),
    }));
  };

  const stopDragging = () => {
    dragRef.current = null;
  };

  const exportPoster = async () => {
    if (!imageRef.current) {
      setStatus("请先上传人物照片，再导出正式海报。");
      fileInputRef.current?.click();
      return;
    }

    setExporting(true);
    setStatus("正在渲染 A3 300 DPI 海报，请稍候……");
    await new Promise((resolve) => window.setTimeout(resolve, 40));

    try {
      await document.fonts.load('256px "Anton"');
      const exportCanvas = document.createElement("canvas");
      renderPoster(exportCanvas, A3_WIDTH, A3_HEIGHT, imageRef.current, controls);
      const rawBlob = await new Promise<Blob>((resolve, reject) => {
        exportCanvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
          "image/png",
        );
      });
      const printBlob = await addPngDpi(rawBlob, 300);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(printBlob);
      link.download = "obsession-a3-300dpi.png";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      setStatus("导出完成：3508 × 4961 px，A3 300 DPI，已保留 OBSESSION 标识。");
    } catch {
      setStatus("导出没有完成，请换用 Chrome 或 Edge 后重试。");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main>
      <header className="topbar">
        <a className="wordmark" href="#studio" aria-label="Obsession 海报实验室首页">
          OBSESSION<span> / POSTER LAB</span>
        </a>
        <div className="privacy-pill"><i /> 照片仅在本机处理</div>
      </header>

      <section className="hero" id="studio">
        <div className="hero-copy">
          <p className="eyebrow">FILM POSTER GENERATOR · FIRST CUT</p>
          <h1>把人物照片，变成一张<br /><em>令人不安的执念。</em></h1>
          <p className="intro">
            参考低照度胶片质感：暖灰背景、压暗肤色、红色边缘光、柔焦与粗颗粒。
            手机现场拍完立刻处理，标题会固定进入成片，适合直接输出 A3 海报。
          </p>
          <div className="capture-actions">
            <button className="upload-hero" onClick={() => setCameraOpen(true)}>
              <span>带站位线拍摄</span>
              <small>花束、双手、花瓶位置实时提示</small>
            </button>
            <button className="album-button" onClick={() => fileInputRef.current?.click()}>
              从相册选择
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
          <div className="poster-frame">
            <canvas
              ref={canvasRef}
              aria-label="Obsession 海报实时预览"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopDragging}
              onPointerCancel={stopDragging}
            />
            {!fileName && (
              <div className="demo-note">
                <span>示意构图</span>
                上传后替换为你的照片
              </div>
            )}
          </div>
          <div className="poster-meta">
            <span>A3 PORTRAIT</span>
            <span>3508 × 4961 PX</span>
            <span>300 DPI</span>
          </div>
          <div className={`quality-badge quality-${quality.tone}`}>{quality.label}</div>
        </div>
      </section>

      <section className="workbench">
        <div className="controls-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DARKROOM CONTROLS</p>
              <h2>暗房调校</h2>
            </div>
            <button
              className="text-button"
              onClick={() => setControls(DEFAULT_CONTROLS)}
            >
              恢复默认
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
          <p className="drag-tip">提示：也可以直接拖动预览中的人物调整构图。</p>
        </div>

        <aside className="export-panel">
          <p className="eyebrow">PRINT MASTER</p>
          <h2>输出打印母版</h2>
          <ul>
            <li><strong>尺寸</strong><span>A3 纵向</span></li>
            <li><strong>像素</strong><span>3508 × 4961</span></li>
            <li><strong>精度</strong><span>300 DPI</span></li>
            <li><strong>标识</strong><span>OBSESSION 固定保留</span></li>
          </ul>
          <button className="export-button" onClick={exportPoster} disabled={exporting}>
            {exporting ? "正在显影…" : "导出 A3 高清 PNG"}
          </button>
          <p className="export-note">打印时选择“实际尺寸 / 100%”，关闭打印机的二次缩放。</p>
        </aside>
      </section>

      <section className="shoot-guide">
        <div>
          <p className="eyebrow">FOR THE SHOOT</p>
          <h2>拍摄时这样准备，滤镜效果最好。</h2>
        </div>
        <ol>
          <li><span>01</span><p><strong>花束贴近脸部</strong>让花遮住部分面孔，人物保留神秘感。</p></li>
          <li><span>02</span><p><strong>穿深色衣服</strong>黑色或深灰能把红色轮廓光衬得更明显。</p></li>
          <li><span>03</span><p><strong>保留双手</strong>拍到腰部以上，双手与花瓶会形成参考图的核心构图。</p></li>
        </ol>
      </section>

      <footer>
        <span>OBSESSION / POSTER LAB</span>
        <p>FIRST CUT · 客户端图像处理 · 无需注册</p>
      </footer>

      {cameraOpen && (
        <section className="camera-overlay" role="dialog" aria-modal="true" aria-label="带站位线拍摄">
          <header className="camera-header">
            <div>
              <span>OBSESSION / CAMERA GUIDE</span>
              <p>把人、花和手放进对应的参考框</p>
            </div>
            <button aria-label="关闭相机" onClick={() => setCameraOpen(false)}>关闭</button>
          </header>

          <div className="camera-viewport">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={cameraFacing === "user" ? "camera-mirrored" : ""}
            />
            <div className="composition-guide" aria-hidden="true">
              <div className="guide-copy">花束遮住部分脸 · 双手进入左右框</div>
              <div className="guide-face"><span>脸 / 花束</span></div>
              <div className="guide-vase"><span>花瓶中线</span></div>
              <div className="guide-hand guide-hand-left"><span>左手</span></div>
              <div className="guide-hand guide-hand-right"><span>右手</span></div>
              <i className="corner corner-tl" />
              <i className="corner corner-tr" />
              <i className="corner corner-bl" />
              <i className="corner corner-br" />
            </div>
            {!cameraReady && !cameraError && <div className="camera-message">正在打开相机…</div>}
            {cameraError && <div className="camera-message camera-error">{cameraError}</div>}
          </div>

          <div className="camera-controls">
            <button className="camera-secondary" onClick={() => setCameraFacing((current) => current === "environment" ? "user" : "environment")}>切换镜头</button>
            <button className="shutter" aria-label="拍摄照片" onClick={captureGuidedPhoto}><i /></button>
            <button className="camera-secondary" onClick={() => cameraInputRef.current?.click()}>系统高清相机</button>
          </div>
        </section>
      )}

      <div className="mobile-capture-bar">
        <button onClick={() => setCameraOpen(true)}>带站位线拍摄</button>
        <button onClick={() => fileInputRef.current?.click()}>相册</button>
      </div>
    </main>
  );
}
