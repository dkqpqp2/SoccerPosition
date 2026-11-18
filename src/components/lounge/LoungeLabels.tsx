"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";

// ── 3D 공간 안의 글자표(이름표·번호표). drei의 Html은 React 19 개발 모드에서 루트 충돌 오류가 나서, 캔버스 텍스처 스프라이트로 그린다 ──
export function Label({
  text,
  position,
  height = 0.3,
  bg = "rgba(0,0,0,0.65)",
  fg = "#ffffff",
  onTop = false,
}: {
  text: string;
  position: [number, number, number];
  height?: number; // 월드 단위 높이(글자표 세로 크기)
  bg?: string;
  fg?: string;
  onTop?: boolean; // true면 다른 물체에 가려지지 않고 항상 보인다(이름표용)
}) {
  const { texture, aspect } = useMemo(() => {
    const scale = 2; // 선명하게 보이도록 2배 해상도로 그린다
    const fontPx = 30 * scale;
    const padX = 14 * scale;
    const h = Math.round(fontPx * 1.55);
    const measure = document.createElement("canvas").getContext("2d")!;
    const font = `700 ${fontPx}px Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    measure.font = font;
    const w = Math.ceil(Math.max(measure.measureText(text).width + padX * 2, h));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + fontPx * 0.04);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, aspect: w / h };
  }, [text, bg, fg]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[height * aspect, height, 1]} renderOrder={onTop ? 10 : 0} raycast={() => null}>
      <spriteMaterial map={texture} transparent depthTest={!onTop} />
    </sprite>
  );
}

export const BUBBLE_MS = 6000; // 말풍선이 떠 있는 시간

// ── 말풍선 그림: 흰 둥근 상자 + 아래 꼬리, 글자 단위로 줄바꿈(최대 3줄) ──
function makeBubbleTexture(text: string): { texture: THREE.CanvasTexture; wCss: number; hCss: number } {
  const scale = 2;
  const fontPx = 26 * scale;
  const lineH = Math.round(fontPx * 1.3);
  const padX = 16 * scale;
  const padY = 11 * scale;
  const tail = 12 * scale;
  const maxTextW = 230 * scale;
  const font = `600 ${fontPx}px Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const lines: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (cur && measure.measureText(cur + ch).width > maxTextW) {
      lines.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 3).map(l => l.trim());
  if (lines.length > 3) shown[2] = [...shown[2]].slice(0, -1).join("") + "…";

  const textW = Math.max(...shown.map(l => measure.measureText(l).width));
  const w = Math.ceil(textW + padX * 2);
  const bodyH = shown.length * lineH + padY * 2;
  const h = bodyH + tail;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, bodyH, 14 * scale);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w / 2 - tail * 0.8, bodyH - 1);
  ctx.lineTo(w / 2 + tail * 0.8, bodyH - 1);
  ctx.lineTo(w / 2, h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#111827";
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  shown.forEach((l, i) => ctx.fillText(l, w / 2, padY + lineH * (i + 0.5) + fontPx * 0.04));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, wCss: w / scale, hCss: h / scale };
}

// ── 머리 위 말풍선 (이름표보다 위에, 다른 물체에 가려지지 않게) ──
export function Bubble({ text }: { text: string }) {
  const { texture, wCss, hCss } = useMemo(() => makeBubbleTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  const k = 0.0055; // 화면 픽셀 → 월드 크기
  return (
    <sprite position={[0, 2.06, 0]} center={[0.5, 0]} scale={[wCss * k, hCss * k, 1]} renderOrder={11} raycast={() => null}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
