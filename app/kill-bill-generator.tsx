"use client";

/* eslint-disable @next/next/no-img-element, @next/next/no-html-link-for-pages -- portable static routes */

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

const crossedNames = [
  ["O-REN ISHII", "COTTONMOUTH"],
  ["VERNITA GREEN", "COPPERHEAD"],
  ["BUDD", "SIDEWINDER"],
  ["ELLE DRIVER", "CALIFORNIA MOUNTAIN SNAKE"],
] as const;

function fitFont(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number,
  family: string,
  weight = "700",
) {
  let size = startSize;
  while (size > 28) {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
}

function drawPaperNoise(context: CanvasRenderingContext2D, width: number, height: number) {
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  context.save();
  for (let index = 0; index < 2800; index += 1) {
    const alpha = 0.012 + random() * 0.028;
    context.fillStyle = `rgba(76, 53, 25, ${alpha})`;
    const size = random() * 2.4 + 0.4;
    context.fillRect(random() * width, random() * height, size, size);
  }
  context.restore();
}

function drawStrike(context: CanvasRenderingContext2D, x: number, y: number, width: number) {
  context.save();
  context.strokeStyle = "rgba(117, 18, 12, 0.9)";
  context.lineCap = "round";
  [0, 1, 2].forEach((line) => {
    context.lineWidth = 8 - line;
    context.beginPath();
    context.moveTo(x - 14, y - 24 + line * 10);
    context.bezierCurveTo(
      x + width * 0.24,
      y - 36 + line * 13,
      x + width * 0.68,
      y + 16 - line * 8,
      x + width + 18,
      y - 12 + line * 7,
    );
    context.stroke();
  });
  context.restore();
}

function drawDeathList(canvas: HTMLCanvasElement, finalName: string) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  const paper = context.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, "#f2e9c6");
  paper.addColorStop(0.52, "#e9ddb2");
  paper.addColorStop(1, "#d7c493");
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  drawPaperNoise(context, width, height);

  context.strokeStyle = "rgba(82, 118, 137, 0.2)";
  context.lineWidth = 2;
  for (let y = 130; y < height; y += 94) {
    context.beginPath();
    context.moveTo(90, y);
    context.lineTo(width - 55, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(157, 58, 47, 0.36)";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(170, 0);
  context.lineTo(170, height);
  context.stroke();

  context.fillStyle = "rgba(82, 69, 42, 0.4)";
  for (let y = 88; y < height - 40; y += 112) {
    context.beginPath();
    context.arc(66, y, 15, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#c8b681";
    context.beginPath();
    context.arc(66, y, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(82, 69, 42, 0.4)";
  }

  const handFont = '"Segoe Print", "Bradley Hand", "KaiTi", cursive';
  context.fillStyle = "#292318";
  context.textAlign = "center";
  context.font = `700 78px ${handFont}`;
  context.fillText("DEATH LIST FIVE", width / 2 + 35, 120);
  context.strokeStyle = "#292318";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(310, 142);
  context.quadraticCurveTo(width / 2, 157, width - 210, 142);
  context.stroke();

  const entries = [...crossedNames, [finalName, "FINAL TARGET"]] as const;
  entries.forEach(([name, alias], index) => {
    const y = 300 + index * 235;
    const circleX = 245;
    context.strokeStyle = "#4a3428";
    context.lineWidth = 7;
    context.beginPath();
    context.arc(circleX, y - 28, 48, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#4a3428";
    context.textAlign = "center";
    context.font = `700 58px ${handFont}`;
    context.fillText(String(index + 1), circleX, y - 8);

    const displayName = name.toUpperCase();
    const nameSize = fitFont(context, displayName, 720, 76, handFont, "700");
    context.textAlign = "left";
    context.fillStyle = index === 4 ? "#9a2019" : "#a42a1f";
    context.font = `700 ${nameSize}px ${handFont}`;
    context.fillText(displayName, 340, y - 24);
    const nameWidth = context.measureText(displayName).width;

    context.fillStyle = "rgba(132, 41, 31, 0.8)";
    context.font = `700 29px ${handFont}`;
    context.fillText(alias, 358, y + 28);

    if (index < 4) drawStrike(context, 328, y - 22, Math.min(nameWidth + 42, 760));
  });

  context.save();
  context.translate(width - 46, height - 55);
  context.rotate(-Math.PI / 2);
  context.fillStyle = "rgba(54, 42, 28, 0.54)";
  context.textAlign = "left";
  context.font = "700 20px Arial, sans-serif";
  context.fillText("COSMOS FILMS · ISSUE 02", 0, 0);
  context.restore();
}

function drawReferenceStrike(context: CanvasRenderingContext2D, x: number, y: number, width: number) {
  context.save();
  context.strokeStyle = "rgba(104, 7, 24, 0.92)";
  context.lineCap = "round";
  [0, 1].forEach((line) => {
    context.lineWidth = 9 - line * 2;
    context.beginPath();
    context.moveTo(x - 12, y - 20 + line * 17);
    context.bezierCurveTo(
      x + width * 0.25,
      y - 31 + line * 21,
      x + width * 0.7,
      y + 13 - line * 12,
      x + width + 14,
      y - 7 + line * 12,
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
) {
  let seed = seedStart;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  context.save();
  context.fillStyle = "rgba(126, 0, 24, 0.84)";
  for (let index = 0; index < 42; index += 1) {
    const angle = random() * Math.PI * 2;
    const distance = Math.pow(random(), 0.62) * 150 * scale;
    const radius = (1.6 + Math.pow(random(), 2.4) * 9) * scale;
    context.beginPath();
    context.ellipse(
      originX + Math.cos(angle) * distance,
      originY + Math.sin(angle) * distance * 0.58,
      radius * (0.7 + random()),
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
  drawDeathList(canvas, finalName);
  const context = canvas.getContext("2d");
  if (!context) return;

  const { width, height } = canvas;
  const paper = context.createLinearGradient(0, 0, width, height);
  paper.addColorStop(0, "#fbfaf3");
  paper.addColorStop(0.56, "#f4f2e8");
  paper.addColorStop(1, "#ebe8dc");
  context.fillStyle = paper;
  context.fillRect(0, 0, width, height);
  drawPaperNoise(context, width, height);

  context.strokeStyle = "rgba(68, 98, 112, 0.28)";
  context.lineWidth = 2.4;
  for (let y = 142; y < height; y += 78) {
    context.beginPath();
    context.moveTo(36, y);
    context.lineTo(width - 34, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(146, 29, 45, 0.42)";
  context.lineWidth = 3.5;
  context.beginPath();
  context.moveTo(150, 0);
  context.lineTo(150, height);
  context.stroke();

  drawBloodSpatter(context, 92, 88, 0.78, 1701);
  drawBloodSpatter(context, width - 125, height - 120, 1.18, 5182);

  const handFont = '"Caveat", "Segoe Print", "Bradley Hand", cursive';
  context.fillStyle = "#171515";
  context.textAlign = "left";
  context.font = `500 100px ${handFont}`;
  context.fillText("Death List Five", 180, 120);
  context.strokeStyle = "#171515";
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(174, 134);
  context.quadraticCurveTo(width / 2, 154, width - 56, 132);
  context.stroke();
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(176, 147);
  context.quadraticCurveTo(width / 2, 163, width - 62, 147);
  context.stroke();

  const entries = [...crossedNames, [finalName, "FINAL TARGET"]] as const;
  entries.forEach(([name, alias], index) => {
    const y = 300 + index * 245;
    const circleX = 220;
    context.strokeStyle = "#171515";
    context.lineWidth = 6;
    context.beginPath();
    context.ellipse(circleX, y - 24, 52 + (index % 2) * 3, 48, -0.08, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = "#171515";
    context.textAlign = "center";
    context.font = `500 67px ${handFont}`;
    context.fillText(String(index + 1), circleX, y - 4);

    const displayName = name.toUpperCase();
    const nameSize = fitFont(context, displayName, 760, 92, handFont, "600");
    context.textAlign = "left";
    context.fillStyle = "#89112a";
    context.font = `600 ${nameSize}px ${handFont}`;
    context.fillText(displayName, 305, y - 24);
    const nameWidth = context.measureText(displayName).width;

    context.fillStyle = "rgba(112, 8, 31, 0.9)";
    context.font = `600 38px ${handFont}`;
    context.fillText(alias, 330, y + 25);

    if (index < 4) drawReferenceStrike(context, 294, y - 22, Math.min(nameWidth + 42, 785));
  });
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

function drawLicense(canvas: HTMLCanvasElement, name: string, alias: string, photo?: HTMLImageElement) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);

  const base = context.createLinearGradient(0, 0, width, height);
  base.addColorStop(0, "#fff9bd");
  base.addColorStop(0.5, "#efe76c");
  base.addColorStop(1, "#d6c92e");
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);
  drawPaperNoise(context, width, height);

  context.strokeStyle = "rgba(101, 82, 12, 0.64)";
  context.lineWidth = 10;
  context.strokeRect(24, 24, width - 48, height - 48);

  context.fillStyle = "#c3171f";
  context.strokeStyle = "#761017";
  context.lineWidth = 3;
  context.textAlign = "center";
  context.font = '900 128px Georgia, "Times New Roman", serif';
  context.strokeText("The Killer License", width / 2, 165);
  context.fillText("The Killer License", width / 2, 165);

  context.fillStyle = "#151511";
  context.textAlign = "left";
  context.font = "800 39px Arial, sans-serif";
  context.fillText("License#", 92, 252);
  context.fillText("Class", 495, 252);
  context.fillText("Restrictions", 890, 252);
  context.font = "400 42px Arial, sans-serif";
  context.fillText("KB-02", 92, 306);
  context.fillText("ASSASSIN", 495, 306);
  context.fillText("NONE", 890, 306);

  const photoX = 92;
  const photoY = 362;
  const photoWidth = 430;
  const photoHeight = 480;
  context.fillStyle = "#d4cf91";
  context.fillRect(photoX, photoY, photoWidth, photoHeight);
  if (photo) {
    context.save();
    context.beginPath();
    context.rect(photoX, photoY, photoWidth, photoHeight);
    context.clip();
    drawImageCover(context, photo, photoX, photoY, photoWidth, photoHeight);
    context.restore();
  } else {
    context.fillStyle = "rgba(25, 25, 17, 0.25)";
    context.beginPath();
    context.arc(photoX + photoWidth / 2, photoY + 162, 92, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.ellipse(photoX + photoWidth / 2, photoY + 380, 148, 118, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "rgba(25, 25, 17, 0.72)";
    context.textAlign = "center";
    context.font = "700 28px Arial, sans-serif";
    context.fillText("ADD YOUR PHOTO", photoX + photoWidth / 2, photoY + 445);
  }
  context.strokeStyle = "#171711";
  context.lineWidth = 8;
  context.strokeRect(photoX, photoY, photoWidth, photoHeight);

  const displayName = name.toUpperCase();
  const nameSize = fitFont(context, displayName, 910, 98, 'Georgia, "Times New Roman", serif', "900");
  context.textAlign = "center";
  context.fillStyle = "#c3171f";
  context.strokeStyle = "#761017";
  context.lineWidth = 2;
  context.font = `900 ${nameSize}px Georgia, "Times New Roman", serif`;
  context.strokeText(displayName, 1035, 520);
  context.fillText(displayName, 1035, 520);

  context.fillStyle = "#171711";
  context.font = "800 34px Arial, sans-serif";
  context.fillText("AKA", 1035, 585);
  context.font = "500 46px Arial, sans-serif";
  context.fillText((alias || "THE BRIDE").toUpperCase(), 1035, 640);

  const fields = [
    ["STATUS", "ACTIVE"],
    ["ISSUE", "02"],
    ["EYES", "DANGEROUS"],
  ];
  fields.forEach(([label, value], index) => {
    const x = 610 + index * 300;
    context.textAlign = "left";
    context.fillStyle = "#171711";
    context.font = "800 30px Arial, sans-serif";
    context.fillText(label, x, 744);
    context.font = "500 38px Arial, sans-serif";
    context.fillText(value, x, 792);
  });

  context.fillStyle = "#c3171f";
  context.textAlign = "right";
  context.font = '900 78px "Anton", Impact, sans-serif';
  context.fillText("KILL BILL", width - 72, height - 62);
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

export default function KillBillGenerator() {
  const deathListRef = useRef<HTMLCanvasElement>(null);
  const licenseRef = useRef<HTMLCanvasElement>(null);
  const [nameMode, setNameMode] = useState<"bill" | "custom">("bill");
  const [customTarget, setCustomTarget] = useState("YOUR NAME");
  const [licenseName, setLicenseName] = useState("BEATRIX KIDDO");
  const [licenseAlias, setLicenseAlias] = useState("THE BRIDE");
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
      if (active && licenseRef.current) {
        drawLicense(
          licenseRef.current,
          (licenseName.trim() || "YOUR NAME").slice(0, 26),
          licenseAlias.slice(0, 24),
          photo,
        );
      }
    };

    document.fonts.ready.then(() => {
      if (!photoUrl) {
        draw();
        return;
      }
      const image = new Image();
      image.onload = () => draw(image);
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
    setPhotoUrl(URL.createObjectURL(file));
  };

  return (
    <main className="kb-page">
      <header className="kb-header">
        <a href="/" className="kb-home-link" aria-label="返回宇宙放映首页">
          <img src="/cosmos42/logo.png" alt="宇宙放映" />
        </a>
        <p>NEXT SCREENING · ISSUE 02</p>
        <a href="#death-list">开始制作 ↓</a>
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
          <p className="kb-maker-intro">前四个名字已经划掉。第五个目标，可以是 BILL，也可以是你自己的名字。</p>
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
          <button className="kb-download" type="button" onClick={() => downloadCanvas(deathListRef.current, `death-list-${targetName.toLowerCase().replace(/\s+/g, "-")}.png`)}>
            下载暗杀名单 PNG <span>↓</span>
          </button>
          <small>名单在你的设备上即时生成，不会上传姓名。</small>
        </div>
        <div className="kb-canvas-stage kb-paper-stage">
          <canvas ref={deathListRef} width={1200} height={1500} aria-label={`暗杀名单，第五个名字为 ${targetName}`} />
        </div>
      </section>

      <section className="kb-maker kb-license-maker" id="id-card" aria-labelledby="license-title">
        <div className="kb-maker-controls">
          <p>02 / KILLER LICENSE</p>
          <h2 id="license-title">身份卡</h2>
          <p className="kb-maker-intro">上传一张照片，写下你的名字与代号，制作属于自己的 Killer License。</p>
          <label className="kb-field">
            <span>姓名</span>
            <input value={licenseName} maxLength={26} onChange={(event) => setLicenseName(event.target.value)} placeholder="YOUR NAME" />
          </label>
          <label className="kb-field">
            <span>代号</span>
            <input value={licenseAlias} maxLength={24} onChange={(event) => setLicenseAlias(event.target.value)} placeholder="THE BRIDE" />
          </label>
          <label className="kb-photo-input">
            <span>{photoUrl ? "更换照片" : "上传照片"}</span>
            <input type="file" accept="image/*,.heic,.heif" onChange={handlePhoto} />
          </label>
          {photoError && <p className="kb-error" role="alert">{photoError}</p>}
          <button className="kb-download" type="button" onClick={() => downloadCanvas(licenseRef.current, `killer-license-${licenseName.toLowerCase().replace(/\s+/g, "-")}.png`)}>
            下载身份卡 PNG <span>↓</span>
          </button>
          <small>照片只在当前浏览器中处理；关闭页面后不会保留。</small>
        </div>
        <div className="kb-canvas-stage kb-card-stage">
          <canvas ref={licenseRef} width={1600} height={1000} aria-label={`Killer License，姓名 ${licenseName}`} />
        </div>
      </section>

      <footer className="kb-footer">
        <a href="/">← 返回宇宙放映</a>
        <p>KILL BILL · ISSUE 02 · COSMOS FILMS</p>
      </footer>
    </main>
  );
}
