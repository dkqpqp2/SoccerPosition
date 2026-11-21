"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { LoungeInfoStatus } from "./useLoungeInfo";

const FONT = `Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
const W = 1440;
const H = 360;

function makeTexture(balance: number | null, status: LoungeInfoStatus): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0f2a1d";
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 40);
  ctx.fill();
  ctx.strokeStyle = "#3f7f5c";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.roundRect(12, 12, W - 24, H - 24, 32);
  ctx.stroke();

  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText("💰 우리 팀 회비 잔액", W / 2, 92);

  let text: string;
  let color = "#ffffff";
  if (balance !== null) {
    text = `${balance.toLocaleString()}원`;
    if (balance < 0) color = "#fca5a5";
  } else {
    text = status === "loading" ? "불러오는 중…" : "잔액을 불러오지 못했어요";
    color = "#9ca3af";
  }
  const fontPx = balance !== null ? 132 : 64;
  ctx.fillStyle = color;
  ctx.font = `900 ${fontPx}px ${FONT}`;
  ctx.fillText(text, W / 2, 205);

  ctx.fillStyle = "#6b7280";
  ctx.font = `600 38px ${FONT}`;
  ctx.fillText("눌러서 자세히 보기", W / 2, 305);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** 바닥에 세워 둔 "팀 회비 잔액" 표지판. 누구나 볼 수 있고, 탭하면 자세한 창이 열린다 */
export default function BalanceWall({
  position,
  balance,
  status,
  onTap,
}: {
  position: [number, number, number];
  balance: number | null;
  status: LoungeInfoStatus;
  onTap: () => void;
}) {
  const texture = useMemo(() => makeTexture(balance, status), [balance, status]);
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
      <mesh position={[-1.55, 0.5, 0]}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <mesh position={[1.55, 0.5, 0]}>
        <boxGeometry args={[0.1, 1, 0.1]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <mesh position={[0, 1.4, 0]}>
        <boxGeometry args={[3.5, 3.3 * (H / W) + 0.16, 0.12]} />
        <meshStandardMaterial color="#374151" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.4, 0.07]}>
        <planeGeometry args={[3.3, 3.3 * (H / W)]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}
