"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  arrowLabelPos, controlPoint, LINE_COLORS, positionColor,
  type BoardSnapshot, type LineType,
} from "@/lib/tacticsBoard";
import { BOARD_BOTTOM, BOARD_CENTER, BOARD_H, BOARD_W, CHAIR_COUNT, chairSlot } from "./loungeConstants";
import { Label } from "./LoungeLabels";

// 전술판 그림을 그리는 캔버스 크기 (세로로 긴 5:7)
const TEX_W = 640;
const TEX_H = 896;
const FONT_FAMILY = 'Pretendard, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';

/** 설명 중인 판(없으면 안내 문구)을 캔버스에 그린다. 모양은 2D 전술판과 같다. */
function drawBoard(ctx: CanvasRenderingContext2D, board: BoardSnapshot | null) {
  const px = (v: number) => (v / 100) * TEX_W;
  const py = (v: number) => (v / 100) * TEX_H;

  const bg = ctx.createLinearGradient(0, 0, 0, TEX_H);
  bg.addColorStop(0, "#166534");
  bg.addColorStop(0.4, "#14532d");
  bg.addColorStop(0.6, "#15803d");
  bg.addColorStop(1, "#166534");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, TEX_W, TEX_H);

  // 경기장 선
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(px(2), py(2), px(96), py(96));
  ctx.beginPath();
  ctx.moveTo(0, py(50));
  ctx.lineTo(TEX_W, py(50));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(50), py(50), px(11), py(6.5), 0, 0, Math.PI * 2);
  ctx.stroke();

  if (!board) {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `700 ${Math.round(TEX_W * 0.05)}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("전술 설명이 시작되면", TEX_W / 2, TEX_H * 0.44);
    ctx.fillText("여기에 나타나요", TEX_W / 2, TEX_H * 0.44 + TEX_W * 0.08);
    return;
  }

  // 화살표 (선 → 화살촉 → 번호)
  const seq: Record<LineType, number> = { move: 0, pass: 0 };
  ctx.lineCap = "round";
  for (const a of board.arrows) {
    const color = LINE_COLORS[a.type];
    const x1 = px(a.x1), y1 = py(a.y1), x2 = px(a.x2), y2 = py(a.y2);
    let tx = x2 - x1, ty = y2 - y1; // 끝점에서의 진행 방향
    ctx.strokeStyle = color;
    ctx.lineWidth = TEX_W * 0.011;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    if (a.mode === "straight") {
      ctx.lineTo(x2, y2);
    } else {
      const { cx, cy } = controlPoint(a);
      ctx.quadraticCurveTo(px(cx), py(cy), x2, y2);
      tx = x2 - px(cx);
      ty = y2 - py(cy);
    }
    ctx.stroke();
    const len = Math.hypot(tx, ty) || 1;
    const ux = tx / len, uy = ty / len;
    const head = TEX_W * 0.034;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2 + ux * head * 0.6, y2 + uy * head * 0.6);
    ctx.lineTo(x2 - ux * head * 0.7 - uy * head * 0.6, y2 - uy * head * 0.7 + ux * head * 0.6);
    ctx.lineTo(x2 - ux * head * 0.7 + uy * head * 0.6, y2 - uy * head * 0.7 - ux * head * 0.6);
    ctx.closePath();
    ctx.fill();
    seq[a.type] += 1;
    const lp = arrowLabelPos(a);
    ctx.beginPath();
    ctx.arc(px(lp.x), py(lp.y), TEX_W * 0.022, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(TEX_W * 0.027)}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(seq[a.type]), px(lp.x), py(lp.y) + 1);
  }

  // 선수·상대·공 (공은 맨 위)
  const ordered = [...board.tokens].sort((a, b) => (a.team === "ball" ? 1 : 0) - (b.team === "ball" ? 1 : 0));
  for (const t of ordered) {
    const cx = px(t.x), cy = py(t.y);
    if (t.team === "ball") {
      const r = TEX_W * 0.034;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#111827";
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = "#111827";
      ctx.fill();
      continue;
    }
    const r = TEX_W * 0.046;
    const pc = t.team === "us" ? positionColor(t.pos) : { bg: "#ffffff", border: "#d1d5db", color: "#111827" };
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = pc.bg;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = pc.border;
    ctx.stroke();
    if (t.label) {
      ctx.fillStyle = pc.color;
      ctx.font = `800 ${Math.round(TEX_W * 0.037)}px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.label, cx, cy + 1);
    }
  }
}

// 판 앞면: 캔버스 그림을 입힌 평면. board가 바뀔 때만 다시 그린다.
function BoardScreen({ board }: { board: BoardSnapshot | null }) {
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return { canvas, texture };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBoard(ctx, board);
    texture.needsUpdate = true;
  }, [board, canvas, texture]);
  return (
    <mesh position={[0, 0, 0.056]} raycast={() => null}>
      <planeGeometry args={[BOARD_W - 0.12, BOARD_H - 0.12]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// ── 의자 (모든 의자가 같은 모양이라 모양·재질을 하나씩만 만들어 나눠 쓴다) ──
const CHAIR_GEO = {
  seat: new THREE.BoxGeometry(0.62, 0.09, 0.6),
  back: new THREE.BoxGeometry(0.62, 0.55, 0.08),
  post: new THREE.BoxGeometry(0.1, 0.42, 0.1),
};
const CHAIR_MAT = {
  seat: new THREE.MeshStandardMaterial({ color: "#9a6b3f", roughness: 0.8 }),
  frame: new THREE.MeshStandardMaterial({ color: "#374151", roughness: 0.6 }),
};

function Chair({ index }: { index: number }) {
  const s = chairSlot(index);
  // 의자의 앞(−z 쪽)이 판 가운데를 향한다. 등받이는 바깥(+z 쪽)에 있다.
  return (
    <group position={[s.x, 0, s.z]} rotation={[0, s.rotY, 0]}>
      <mesh geometry={CHAIR_GEO.seat} material={CHAIR_MAT.seat} position={[0, 0.46, 0]} dispose={null} raycast={() => null} />
      <mesh geometry={CHAIR_GEO.back} material={CHAIR_MAT.seat} position={[0, 0.8, 0.28]} dispose={null} raycast={() => null} />
      <mesh geometry={CHAIR_GEO.post} material={CHAIR_MAT.frame} position={[0, 0.21, 0]} dispose={null} raycast={() => null} />
    </group>
  );
}

/**
 * 방 한가운데의 전술판과 그 앞에 반원으로 놓인 의자.
 * 판에는 지금 설명 중인 내용이 그대로 보인다(설명하는 사람이 없으면 안내 문구). 판을 탭하면 onTap.
 */
export default function TacticsCorner({ board, presenterName, onTap }: { board: BoardSnapshot | null; presenterName: string | null; onTap: () => void }) {
  const centerY = BOARD_BOTTOM + BOARD_H / 2;
  return (
    <group>
      <group
        position={[BOARD_CENTER.x, 0, BOARD_CENTER.z]}
        onClick={e => {
          if (e.delta > 8) return;
          e.stopPropagation();
          onTap();
        }}
      >
        {/* 다리 두 개 */}
        {[-1, 1].map(side => (
          <mesh key={side} position={[side * (BOARD_W / 2 - 0.15), BOARD_BOTTOM / 2, 0]}>
            <boxGeometry args={[0.1, BOARD_BOTTOM, 0.1]} />
            <meshStandardMaterial color="#4b5563" />
          </mesh>
        ))}
        {/* 판 틀과 화면 */}
        <group position={[0, centerY, 0]}>
          <mesh>
            <boxGeometry args={[BOARD_W, BOARD_H, 0.1]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.4} />
          </mesh>
          <BoardScreen board={board} />
        </group>
        <Label
          text={presenterName ? `🎤 ${presenterName}님 설명 중` : "전술판"}
          position={[0, BOARD_BOTTOM + BOARD_H + 0.35, 0.1]}
          height={0.34}
          bg={presenterName ? "#059669" : "#3f7f5c"}
          fg="#ffffff"
        />
      </group>
      {Array.from({ length: CHAIR_COUNT }, (_, i) => <Chair key={i} index={i} />)}
    </group>
  );
}
