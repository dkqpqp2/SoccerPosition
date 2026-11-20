"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { Board, LeaderboardData, LeaderboardStatus } from "./useLeaderboard";

const FONT = `Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const W = 1440;
const H = 880;

const ROWS = [
  { key: "goals", label: "득점왕", color: "#fbbf24", unit: (v: number) => `${v}골` },
  { key: "assists", label: "도움왕", color: "#38bdf8", unit: (v: number) => `${v}도움` },
  { key: "attendance", label: "참석왕", color: "#86efac", unit: (v: number) => `${v}%` },
] as const;

// 이름이 길면 글자 크기를 줄여서 칸 안에 맞춘다
function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxPx: number, minPx: number, weight = 800) {
  for (let px = maxPx; px >= minPx; px -= 4) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return;
  }
  ctx.font = `${weight} ${minPx}px ${FONT}`;
}

function nameOf(board: Board): string {
  if (!board.rows.length) return "";
  const first = board.rows[0];
  return board.tied > 1 ? `${first.name} 외 ${board.tied - 1}명` : first.name;
}

// 보드 앞면 그림: 득점왕·도움왕·참석왕 1등을 한눈에
function makeTexture(data: LeaderboardData | null, status: LeaderboardStatus): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f2a1d";
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 48);
  ctx.fill();
  ctx.strokeStyle = "#3f7f5c";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.roundRect(14, 14, W - 28, H - 28, 40);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#e5e7eb";
  ctx.font = `900 92px ${FONT}`;
  ctx.fillText("🏆 명예의 전당", W / 2, 105);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `600 46px ${FONT}`;
  ctx.fillText(data ? `${data.year} 시즌` : " ", W / 2, 188);

  if (!data) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = `700 64px ${FONT}`;
    ctx.fillText(status === "error" ? "순위를 불러오지 못했어요" : "불러오는 중…", W / 2, H / 2 + 90);
    return finish(canvas);
  }

  ROWS.forEach((row, i) => {
    const cy = 340 + i * 200;
    const board = data.boards[row.key];
    const top = board.rows[0];

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath();
    ctx.roundRect(70, cy - 80, W - 140, 160, 32);
    ctx.fill();

    ctx.textAlign = "left";
    ctx.fillStyle = row.color;
    ctx.font = `800 58px ${FONT}`;
    ctx.fillText(row.label, 120, cy);

    if (!top) {
      ctx.fillStyle = "#6b7280";
      ctx.font = `700 56px ${FONT}`;
      ctx.fillText("기록 없음", 410, cy);
      return;
    }

    ctx.fillStyle = "#ffffff";
    fitFont(ctx, nameOf(board), 560, 68, 36);
    ctx.fillText(nameOf(board), 410, cy);

    ctx.textAlign = "right";
    ctx.fillStyle = row.color;
    ctx.font = `900 68px ${FONT}`;
    ctx.fillText(row.unit(top.value), W - 120, cy);
  });

  return finish(canvas);
}

function finish(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** 라운지에 세워 둔 "명예의 전당" 보드. 탭하면 순위 창이 열린다 */
export default function HallOfFameBoard({
  position,
  data,
  status,
  onTap,
}: {
  position: [number, number, number];
  data: LeaderboardData | null;
  status: LeaderboardStatus;
  onTap: () => void;
}) {
  const texture = useMemo(() => makeTexture(data, status), [data, status]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group
      position={position}
      onClick={e => {
        if (e.delta > 8) return;
        e.stopPropagation();
        onTap();
      }}
    >
      <mesh position={[-1.5, 0.45, 0]}>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <mesh position={[1.5, 0.45, 0]}>
        <boxGeometry args={[0.12, 0.9, 0.12]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <mesh position={[0, 1.95, 0]}>
        <boxGeometry args={[3.7, 2.3, 0.12]} />
        <meshStandardMaterial color="#374151" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.95, 0.07]}>
        <planeGeometry args={[3.5, 3.5 * (H / W)]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
