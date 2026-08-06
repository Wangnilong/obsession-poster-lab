"use client";

/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- portable static routes */

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

const crossedNames = [
  ["O-REN ISHII", "COTTONMOUTH"],
  ["VERNITA GREEN", "COPPER HEAD"],
  ["BUDD", "SIDE WINDER"],
  ["ELLE DRIVER", "CALIFORNIA MOUNTAIN SNAKE"],
] as const;

const handFont = '"Caveat", "Segoe Print", "Bradley Hand", cursive';
const licenseSerif = '"Cooper Black", "Rockwell Extra Bold", Georgia, serif';

function fitFont(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  family: string,
  weight = "700",
) {
  let size = startSize;
  while (size > 24) {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function seededRandom(seedStart: number) {
  let seed = seedStart;
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function drawFineGrain(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  seed: number,
  color = "82, 64, 35",
  count = 3000,
) {
  const random = seededRandom(seed);
  context.save();
  for (let index = 0; index < count; index += 1) {
    const alpha = 0.008 + random() * 0.026;
    context.fillStyle = `rgba(${color}, ${alpha})`;
    const size = random() * 2.1 + 0.35;
    context.fillRect(random() * width, random() * height, size, size);
  }
  context.restore();
}

function drawCrumpledPaper(context: CanvasRenderingContext2D) {
  const width = 1200;
  const height = 1700;
  const paper = context.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, "#fffefa");
  paper.addColorStop(0.5, "#f7f7f3");
  paper.addColorStop(1, "#ecece8");
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);

  const random = seededRandom(421970);
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.filter = "blur(7px)";
  for (let index = 0; index < 86; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const length = 100 + random() * 420;
    const angle = random() * Math.PI * 2;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    context.strokeStyle = random() > 0.48 ? "rgba(92, 96, 92, 0.055)" : "rgba(255, 255, 255, 0.42)";
    context.lineWidth = 2 + random() * 8;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(
      x + (endX - x) * 0.3 + (random() - 0.5) * 70,
      y + (endY - y) * 0.3 + (random() - 0.5) * 70,
      x + (endX - x) * 0.68 + (random() - 0.5) * 60,
      y + (endY - y) * 0.68 + (random() - 0.5) * 60,
      endX,
      endY,
    );
    context.stroke();
  }
  context.restore();

  context.save();
  context.globalCompositeOperation = "multiply";
  for (let index = 0; index < 24; index += 1) {
    const x = random() * width;
    const y = random() * height;
    const gradient = context.createRadialGradient(x, y, 0, x, y, 110 + random() * 180);
    gradient.addColorStop(0, "rgba(82, 86, 82, 0.035)");
    gradient.addColorStop(1, "rgba(82, 86, 82, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }
  context.restore();
  drawFineGrain(context, width, height, 9714, "48, 48, 45", 4200);
}

function drawReferenceStrike(context: CanvasRenderingContext2D, x: number, y: number, width: number, seed: number) {
  const random = seededRandom(seed);
  context.save();
  context.strokeStyle = "rgba(151, 0, 11, 0.92)";
  context.lineCap = "round";
  [0, 1].forEach((line) => {
    context.lineWidth = line === 0 ? 4.2 : 2.2;
    context.beginPath();
    context.moveTo(x - 10, y - 8 + line * 11);
    context.bezierCurveTo(
      x + width * 0.22,
      y - 16 + random() * 13 + line * 7,
      x + width * 0.72,
      y + 10 - random() * 13 - line * 5,
      x + width + 12,
      y - 4 + line * 8,
    );
    context.stroke();
  });
  context.restore();
}

function drawBloodSpatter(
  context: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  scale: number,
  seedStart: number,
  rotation = 0,
) {
  const random = seededRandom(seedStart);
  context.save();
  context.translate(originX, originY);
  context.rotate(rotation);
  context.fillStyle = "rgba(148, 0, 4, 0.9)";
  context.strokeStyle = "rgba(118, 0, 4, 0.82)";

  context.lineCap = "round";
  for (let index = 0; index < 9; index += 1) {
    const startX = (random() - 0.5) * 60 * scale;
    const startY = (random() - 0.5) * 44 * scale;
    const reach = (70 + random() * 235) * scale;
    context.lineWidth = (2 + random() * 8) * scale;
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(
      startX + reach * 0.28,
      startY + (random() - 0.5) * 38 * scale,
      startX + reach * 0.68,
      startY + (random() - 0.5) * 52 * scale,
      startX + reach,
      startY + (random() - 0.5) * 70 * scale,
    );
    context.stroke();
  }

  for (let index = 0; index < 58; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.pow(random(), 0.68) * 215 * scale;
    const radius = (1.2 + Math.pow(random(), 2.8) * 10) * scale;
    context.beginPath();
    context.ellipse(
      Math.cos(angle) * distance,
      Math.sin(angle) * distance * 0.52,
      radius * (0.5 + random() * 1.7),
      radius,
      angle,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

function drawReferenceDeathList(canvas: HTMLCanvasElement, finalName: string) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const scaleX = canvas.width / 1200;
  const scaleY = canvas.height / 1700;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.scale(scaleX, scaleY);

  drawCrumpledPaper(context);

  context.fillStyle = "#121212";
  context.textAlign = "left";
  context.font = `400 112px ${handFont}`;
  context.fillText("Death List Five", 267, 186);
  context.strokeStyle = "#151515";
  context.lineCap = "round";
  context.lineWidth = 4;
  context.beginPath();
  context.moveTo(260, 198);
  context.quadraticCurveTo(616, 220, 930, 193);
  context.stroke();

  const entries = [...crossedNames, [finalName, ""]] as const;
  const yPositions = [365, 585, 808, 1048, 1305];
  entries.forEach(([name, alias], index) => {
    const y = yPositions[index];
    const circleX = 246;
    context.strokeStyle = "#111111";
    context.lineWidth = index === 4 ? 5.2 : 4.2;
    context.beginPath();
    context.ellipse(circleX, y - 30, 58 + index * 1.5, 63 + (index % 2) * 5, -0.08 + index * 0.018, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#111111";
    context.textAlign = "center";
    context.font = `400 80px ${handFont}`;
    context.fillText(String(index + 1), circleX, y - 3);

    const displayName = name.toUpperCase();
    const nameSize = fitFont(context, displayName, 770, index === 4 ? 128 : 94, handFont, "400");
    context.textAlign = "left";
    context.fillStyle = "#cf0b10";
    context.font = `400 ${nameSize}px ${handFont}`;
    context.fillText(displayName, 342, y);
    const nameWidth = context.measureText(displayName).width;

    if (alias) {
      const aliasSize = fitFont(context, alias, 720, 48, handFont, "500");
      context.font = `500 ${aliasSize}px ${handFont}`;
      context.fillText(alias, 374, y + 56);
    }

    if (index < 4) {
      drawReferenceStrike(context, 331, y - 31, Math.min(nameWidth + 34, 790), 250 + index * 91);
    }
  });

  drawBloodSpatter(context, 1035, 650, 0.74, 1701, -2.18);
  drawBloodSpatter(context, 940, 1140, 1.08, 5182, -2.45);
  drawBloodSpatter(context, 240, 1600, 0.9, 7411, -0.12);
  drawBloodSpatter(context, 650, 1630, 1.2, 9324, -0.18);
  context.restore();
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawLicenseSurface(context: CanvasRenderingContext2D, width: number, height: number) {
  context.save();
  roundedRectPath(context, 8, 8, width - 16, height - 16, 58);
  context.clip();

  const base = context.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#fffef1");
  base.addColorStop(0.3, "#f7f5d9");
  base.addColorStop(0.63, "#ffffee");
  base.addColorStop(1, "#eef2ce");
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);

  const glowColumns = [84, 310, 575, 825, 1090, 1370, 1590];
  glowColumns.forEach((x, index) => {
    const gradient = context.createLinearGradient(x - 80, 0, x + 110, 0);
    gradient.addColorStop(0, "rgba(255, 244, 0, 0)");
    gradient.addColorStop(0.45, `rgba(255, 239, 0, ${index % 2 ? 0.14 : 0.22})`);
    gradient.addColorStop(0.58, "rgba(255, 255, 255, 0.34)");
    gradient.addColorStop(1, "rgba(255, 244, 0, 0)");
    context.fillStyle = gradient;
    context.fillRect(x - 90, 0, 210, height);
  });

  context.save();
  context.globalAlpha = 0.28;
  context.strokeStyle = "rgba(255, 255, 255, 0.7)";
  context.lineWidth = 26;
  context.beginPath();
  context.moveTo(-80, 980);
  context.bezierCurveTo(430, 660, 670, 920, 1130, 505);
  context.bezierCurveTo(1370, 294, 1510, 220, 1800, 120);
  context.stroke();
  context.restore();
  drawFineGrain(context, width, height, 62970, "102, 91, 30", 2600);
  context.restore();

  context.save();
  roundedRectPath(context, 8, 8, width - 16, height - 16, 58);
  context.strokeStyle = "rgba(115, 105, 54, 0.42)";
  context.lineWidth = 7;
  context.stroke();
  context.restore();
}

function drawLabelValue(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  align: CanvasTextAlign = "left",
) {
  context.textAlign = align;
  context.fillStyle = "#171713";
  context.font = "800 35px Arial, sans-serif";
  context.fillText(label, x, y);
  context.font = "400 40px Arial, sans-serif";
  context.fillText(value, x, y + 48);
}

function drawOutlinedSerif(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  maxWidth?: number,
) {
  const actualSize = maxWidth ? fitFont(context, text, maxWidth, size, licenseSerif, "900") : size;
  context.font = `900 ${actualSize}px ${licenseSerif}`;
  context.fillStyle = "#d61b32";
  context.strokeStyle = "#75151f";
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, actualSize * 0.025);
  context.strokeText(text, x, y);
  context.fillText(text, x, y);
}

function drawLicenseFront(canvas: HTMLCanvasElement, name: string, alias: string, photo?: HTMLImageElement) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  drawLicenseSurface(context, width, height);

  context.textAlign = "center";
  drawOutlinedSerif(context, "The Killer License", width / 2, 186, 136, 1500);

  drawLabelValue(context, 86, 276, "License#", "TU-KB-01");
  drawLabelValue(context, 500, 276, "Birthdate", "04.29.1970");
  drawLabelValue(context, 870, 276, "Class", "ASSASSIN");
  drawLabelValue(context, 1285, 276, "Restrictions", "BILL");

  const photoX = 86;
  const photoY = 404;
  const photoWidth = 410;
  const photoHeight = 500;
  context.fillStyle = "#eeefd1";
  context.fillRect(photoX, photoY, photoWidth, photoHeight);
  if (photo) {
    context.save();
    context.beginPath();
    context.rect(photoX, photoY, photoWidth, photoHeight);
    context.clip();
    drawImageCover(context, photo, photoX, photoY, photoWidth, photoHeight);
    context.restore();
  } else {
    context.fillStyle = "rgba(26, 27, 20, 0.2)";
    context.beginPath();
    context.arc(photoX + photoWidth / 2, photoY + 150, 88, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(photoX + photoWidth / 2, photoY + 378, 142, 132, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(25, 25, 18, 0.62)";
    context.textAlign = "center";
    context.font = "800 25px Arial, sans-serif";
    context.fillText("ADD YOUR PHOTO", photoX + photoWidth / 2, photoY + 464);
  }
  context.strokeStyle = "#161611";
  context.lineWidth = 8;
  context.strokeRect(photoX, photoY, photoWidth, photoHeight);

  const displayAlias = (alias.trim() || "UMA THURMAN").toUpperCase();
  const aliasSize = fitFont(context, displayAlias, 980, 54, "Arial, sans-serif", "400");
  context.textAlign = "center";
  context.fillStyle = "#171713";
  context.font = `400 ${aliasSize}px Arial, sans-serif`;
  context.fillText(displayAlias, 1080, 460);
  context.font = "700 30px Arial, sans-serif";
  context.fillText("AKA", 1080, 505);

  const displayName = (name.trim() || "BEATRIX KIDDO").toUpperCase();
  drawOutlinedSerif(context, displayName, 1080, 590, 86, 1040);
  context.fillStyle = "#171713";
  context.font = "400 42px Arial, sans-serif";
  context.fillText("5 S Kill Bill Blvd", 1080, 654);
  context.fillText("El Paso, TX 79927", 1080, 704);

  drawLabelValue(context, 555, 815, "Sex", "F");
  drawLabelValue(context, 760, 815, "Height", "5'11\"");
  drawLabelValue(context, 990, 815, "Weight", "140");
  drawLabelValue(context, 1222, 815, "Hair", "BLONDE");
  drawLabelValue(context, 1515, 815, "Eyes", "BLUE", "center");

  context.fillStyle = "rgba(33, 34, 24, 0.58)";
  context.textAlign = "right";
  context.font = "700 20px Arial, sans-serif";
  context.fillText("ISSUED BY COSMOS FILMS · ISSUE 02", width - 64, height - 48);
}

function drawLicenseBack(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  drawLicenseSurface(context, width, height);

  const title = "KILL BILL";
  const titleSize = fitFont(context, title, width - 250, 250, '"Anton", Impact, sans-serif', "400");
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `400 ${titleSize}px "Anton", Impact, sans-serif`;
  context.fillStyle = "#d71832";
  context.strokeStyle = "#79131d";
  context.lineWidth = 6;
  context.lineJoin = "round";
  context.strokeText(title, width / 2, height / 2 + 12);
  context.fillText(title, width / 2, height / 2 + 12);
  context.textBaseline = "alphabetic";
}

function downloadCanvas(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return;
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

function downloadA3DeathList(finalName: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 3508;
  canvas.height = 4961;
  drawReferenceDeathList(canvas, finalName);
  downloadCanvas(canvas, `death-list-${finalName.toLowerCase().replace(/\s+/g, "-")}-a3-300dpi.png`);
}

export default function KillBillGenerator() {
  const deathListRef = useRef<HTMLCanvasElement>(null);
  const licenseFrontRef = useRef<HTMLCanvasElement>(null);
  const licenseBackRef = useRef<HTMLCanvasElement>(null);
  const [nameMode, setNameMode] = useState<"bill" | "custom">("bill");
  const [customTarget, setCustomTarget] = useState("YOUR NAME");
  const [licenseName, setLicenseName] = useState("BEATRIX KIDDO");
  const [licenseAlias, setLicenseAlias] = useState("UMA THURMAN");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoError, setPhotoError] = useState("");

  const targetName = useMemo(
    () => (nameMode === "bill" ? "BILL" : customTarget.trim() || "YOUR NAME"),
    [customTarget, nameMode],
  );

  useEffect(() => {
    let active = true;
    document.fonts.ready.then(() => {
      if (active && deathListRef.current) drawReferenceDeathList(deathListRef.current, targetName.slice(0, 24));
    });
    return () => { active = false; };
  }, [targetName]);

  useEffect(() => {
    let active = true;
    const draw = (photo?: HTMLImageElement) => {
      if (!active) return;
      if (licenseFrontRef.current) {
        drawLicenseFront(
          licenseFrontRef.current,
          (licenseName.trim() || "YOUR NAME").slice(0, 26),
          licenseAlias.slice(0, 24),
          photo,
        );
      }
      if (licenseBackRef.current) drawLicenseBack(licenseBackRef.current);
    };

    document.fonts.ready.then(() => {
      if (!photoUrl) {
        draw();
        return;
      }
      const image = new Image();
      image.onload = () => draw(image);
      image.onerror = () => setPhotoError("这张图片无法读取，请换一张 JPG 或 PNG。");
      image.src = photoUrl;
    });

    return () => { active = false; };
  }, [licenseAlias, licenseName, photoUrl]);

  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const handlePhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("请选择 JPG、PNG 或 HEIC 图片。");
      return;
    }
    if (file.size > 24 * 1024 * 1024) {
      setPhotoError("图片请控制在 24MB 以内。");
      return;
    }
    setPhotoError("");
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(file));
  };

  const filenameName = (licenseName.trim() || "your-name").toLowerCase().replace(/\s+/g, "-");

  return (
    <main className="kb-page">
      <header className="kb-header">
        <a href="/" className="kb-home-link" aria-label="返回宇宙放映首页">
          <img src="/cosmos42/logo.png" alt="宇宙放映" />
        </a>
        <p>NEXT SCREENING · ISSUE 02</p>
        <a href="#death-list">开始制作 ↘</a>
      </header>

      <section className="kb-hero" aria-labelledby="kb-title">
        <div className="kb-hero-image" aria-hidden="true">
          <img src="/kill-bill/death-list-still.jpg" alt="" />
        </div>
        <div className="kb-hero-copy">
          <p>COSMOS FILMS PRESENTS</p>
          <h1 id="kb-title"><span>KILL</span><span>BILL</span></h1>
          <strong>把第五个名字，换成你自己。</strong>
          <nav aria-label="生成器模式">
            <a href="#death-list">暗杀名单</a>
            <a href="#id-card">Killer License</a>
          </nav>
        </div>
        <span className="kb-hero-issue" aria-hidden="true">02</span>
      </section>

      <section className="kb-maker kb-death-maker" id="death-list" aria-labelledby="death-title">
        <div className="kb-maker-controls">
          <p>01 / DEATH LIST FIVE</p>
          <h2 id="death-title">暗杀名单</h2>
          <p className="kb-maker-intro">按电影里的白色皱纸、红黑手写字和血迹重新制作。前四个名字已经划掉，第五个可以是 BILL，也可以是你。</p>
          <div className="kb-segmented" aria-label="第五个名字模式">
            <button type="button" className={nameMode === "bill" ? "active" : ""} onClick={() => setNameMode("bill")}>BILL</button>
            <button type="button" className={nameMode === "custom" ? "active" : ""} onClick={() => setNameMode("custom")}>我的名字</button>
          </div>
          <label className={nameMode === "bill" ? "kb-field is-disabled" : "kb-field"}>
            <span>第五个名字</span>
            <input
              value={customTarget}
              maxLength={24}
              disabled={nameMode === "bill"}
              onChange={(event) => setCustomTarget(event.target.value)}
              placeholder="输入你的名字"
            />
          </label>
          <button className="kb-download" type="button" onClick={() => downloadA3DeathList(targetName.slice(0, 24))}>
            下载 A3 300DPI 暗杀名单 <span>↓</span>
          </button>
          <small>高清文件在你的设备本地生成，不上传姓名；画面比例为 A3。</small>
        </div>
        <div className="kb-canvas-stage kb-paper-stage">
          <canvas ref={deathListRef} width={1200} height={1700} aria-label={`暗杀名单，第五个名字为 ${targetName}`} />
        </div>
      </section>

      <section className="kb-maker kb-license-maker" id="id-card" aria-labelledby="license-title">
        <div className="kb-maker-controls">
          <p>02 / THE KILLER LICENSE</p>
          <h2 id="license-title">杀手身份卡</h2>
          <p className="kb-maker-intro">按实物版本重做：正面是照片、姓名与完整证件信息，背面只有巨大的 KILL BILL。两面可以分别下载。</p>
          <label className="kb-field">
            <span>卡面姓名</span>
            <input value={licenseName} maxLength={26} onChange={(event) => setLicenseName(event.target.value)} placeholder="BEATRIX KIDDO" />
          </label>
          <label className="kb-field">
            <span>人物 / AKA</span>
            <input value={licenseAlias} maxLength={24} onChange={(event) => setLicenseAlias(event.target.value)} placeholder="UMA THURMAN" />
          </label>
          <label className="kb-photo-input">
            <span>{photoUrl ? "更换证件照" : "上传证件照"}</span>
            <input type="file" accept="image/*,.heic,.heif" onChange={handlePhoto} />
          </label>
          {photoError && <p className="kb-error" role="alert">{photoError}</p>}
          <div className="kb-download-row">
            <button className="kb-download" type="button" onClick={() => downloadCanvas(licenseFrontRef.current, `killer-license-${filenameName}-front.png`)}>
              下载正面 PNG <span>↓</span>
            </button>
            <button className="kb-download kb-download-secondary" type="button" onClick={() => downloadCanvas(licenseBackRef.current, `killer-license-${filenameName}-back.png`)}>
              下载背面 PNG <span>↓</span>
            </button>
          </div>
          <small>照片只在当前浏览器中处理；正反面均为 1712 × 1080 高清 PNG。</small>
        </div>
        <div className="kb-canvas-stage kb-card-stage">
          <div className="kb-card-pair">
            <figure>
              <canvas ref={licenseFrontRef} width={1712} height={1080} aria-label={`Killer License 正面，姓名 ${licenseName}`} />
              <figcaption>FRONT / 正面</figcaption>
            </figure>
            <figure>
              <canvas ref={licenseBackRef} width={1712} height={1080} aria-label="Killer License 背面，KILL BILL" />
              <figcaption>BACK / 背面</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <footer className="kb-footer">
        <a href="/">↙ 返回宇宙放映</a>
        <p>KILL BILL · ISSUE 02 · COSMOS FILMS</p>
      </footer>
    </main>
  );
}
