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
      `brightness(${0.9 - intensity * 0.03})`,
      `contrast(${1.08 + intensity * 0.15})`,
      `saturate(${0.82 - intensity * 0.23})`,
      `sepia(${0.1 + intensity * 0.16})`,
      `blur(${Math.max(0.15, width / A3_WIDTH) * 0.9}px)`,
    ].join(" ");
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    context.filter = "none";
  } else {
    drawDemo(context, width, height);
  }

  const warmWash = context.createLinearGradient(0, 0, width, height);
  warmWash.addColorStop(0, `rgba(111, 93, 67, ${0.1 + controls.intensity / 1300})`);
  warmWash.addColorStop(0.55, "rgba(20, 22, 19, .1)");
  warmWash.addColorStop(1, "rgba(2, 5, 5, .25)");
  context.globalCompositeOperation = "multiply";
  context.fillStyle = warmWash;
  context.fillRect(0, 0, width, height);

  context.globalCompositeOperation = "screen";
  const handGlow = context.createLinearGradient(0, height * 0.43, width, height * 0.78);
  handGlow.addColorStop(0, "rgba(171, 38, 31, .08)");
  handGlow.addColorStop(0.42, "rgba(0, 0, 0, 0)");
  handGlow.addColorStop(0.68, "rgba(0, 0, 0, 0)");
  handGlow.addColorStop(1, "rgba(177, 43, 34, .1)");
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
  vignette.addColorStop(0.65, `rgba(0, 0, 0, ${controls.vignette / 900})`);
  vignette.addColorStop(1, `rgba(0, 0, 0, ${0.34 + controls.vignette / 600})`);
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);

  const titleY = height * 0.922;
  const fontSize = fitTitle(context, width, height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${fontSize}px Anton, Impact, sans-serif`;
  context.save();
  context.translate(width * 0.5, 0);
  context.scale(0.965, 1);
  context.shadowColor = "rgba(117, 16, 12, .38)";
  context.shadowBlur = fontSize * 0.035;
  context.fillStyle = "#d92f26";
  context.filter = `blur(${fontSize * 0.016}px)`;
  context.fillText("OBSESSION", 0, titleY);
  context.shadowBlur = 0;
  context.globalAlpha = 0.46;
  context.fillStyle = "#ed3b30";
  context.filter = `blur(${fontSize * 0.006}px)`;
  context.fillText("OBSESSION", 0, titleY - fontSize * 0.008);
  context.filter = "none";
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

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
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
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [controls, setControls] = useState(DEFAULT_CONTROLS);
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
      const suggestedOffset = clamp((0.22 - faceCenterY) * 160, -70, 70);
      setControls((current) => ({ ...current, offsetY: Math.round(suggestedOffset) }));
      setStatus("已识别人脸并自动对齐到海报视觉中心。");
    } catch {
      setStatus("已使用海报默认构图。可拖动画面或用滑杆微调人物位置。");
    }
  }, []);

  const loadFile = useCallback(
    (file: File, poseForAdjustment?: PoseLandmark[] | null) => {
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
        const aiControls = poseForAdjustment
          ? controlsFromPose(poseForAdjustment)
          : null;
        setControls(aiControls ?? DEFAULT_CONTROLS);
        setAiAdjusted(Boolean(aiControls));
        const megapixels = (image.naturalWidth * image.naturalHeight) / 1_000_000;
        if (megapixels >= 16 && Math.max(image.naturalWidth, image.naturalHeight) >= 4800) {
          setQuality({ tone: "excellent", label: `原图 ${megapixels.toFixed(1)}MP · A3 优秀` });
        } else if (megapixels >= 10) {
          setQuality({ tone: "good", label: `原图 ${megapixels.toFixed(1)}MP · A3 可用` });
        } else {
          setQuality({ tone: "low", label: `原图 ${megapixels.toFixed(1)}MP · 建议换高清图` });
        }
        if (aiControls) {
          setStatus("AI 已校正人物大小和位置，滤镜也已套用。");
        } else {
          setStatus("照片已载入，正在检查人物位置……");
          void autoAlign(image);
        }
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
        loadFile(
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
        <a className="wordmark" href="#booth" aria-label="Obsession 拍照亭首页">
          OBSESSION
        </a>
        <div className="privacy-pill"><i /> PRIVATE ON DEVICE</div>
      </header>

      <section className="hero" id="booth">
        <div className="hero-copy">
          <p className="eyebrow">OBSESSION PHOTO BOOTH / 01</p>
          <h1>站进去。<br /><em>拍一张。</em></h1>
          <p className="intro">花挡住脸，双手抱紧花瓶。剩下的交给暗房。</p>
          <div className="capture-actions">
            <button className="upload-hero" onClick={() => setCameraOpen(true)}>
              <span>打开相机</span>
              <small>按原海报站位拍摄</small>
            </button>
            <button className="album-button" onClick={() => fileInputRef.current?.click()}>
              选照片
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
                <span>LIVE PREVIEW</span>
                等你入镜
              </div>
            )}
          </div>
          <div className="poster-meta">
            <span>A3 PORTRAIT</span>
            <span>3508 × 4961 PX</span>
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
              <h2>调到你喜欢。</h2>
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
          <p className="drag-tip">直接拖动海报，也能调整人物位置。</p>
        </div>

        <aside className="export-panel">
          <p className="eyebrow">TAKE IT / 03</p>
          <h2>带走海报。</h2>
          <ul>
            <li><strong>尺寸</strong><span>A3 纵向</span></li>
            <li><strong>像素</strong><span>3508 × 4961</span></li>
            <li><strong>精度</strong><span>300 DPI</span></li>
            <li><strong>标题</strong><span>固定保留</span></li>
          </ul>
          <button className="export-button" onClick={exportPoster} disabled={exporting}>
            {exporting ? "正在显影…" : "下载 A3 打印版"}
          </button>
          <p className="export-note">打印时选择“实际尺寸 / 100%”，关闭打印机的二次缩放。</p>
        </aside>
      </section>

      <section className="shoot-guide" aria-label="拍摄准备">
        <div className="rule"><span>01</span><strong>花挡脸</strong></div>
        <div className="rule"><span>02</span><strong>手抱瓶</strong></div>
        <div className="rule"><span>03</span><strong>穿深色</strong></div>
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
        <button onClick={() => setCameraOpen(true)}>拍照</button>
        <button onClick={() => fileInputRef.current?.click()}>相册</button>
      </div>
    </main>
  );
}
