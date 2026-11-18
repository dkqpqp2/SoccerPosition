"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import Link from "next/link";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import TacticsSessionPanel, { type TacticsMode } from "./TacticsSessionPanel";
import { MAX_CHAT_LENGTH, useLoungeRoom, type ChatMessage, type OtherPlayer } from "./useLoungeRoom";
import { useLeaderboard } from "./useLeaderboard";
import HallOfFameBoard from "./HallOfFameBoard";
import LeaderboardModal from "./LeaderboardModal";

// ── 방 크기(미터 느낌의 단위) ──
const ROOM_W = 24;
const ROOM_D = 16;
const WALL_H = 3.6;
const LIMIT_X = ROOM_W / 2 - 1.4; // 양옆 벽 락커 앞까지
const LIMIT_Z_MIN = -ROOM_D / 2 + 1.4; // 뒷벽 락커 앞까지
const LIMIT_Z_MAX = ROOM_D / 2 - 0.7;
const SPEED = 3.8; // 초당 이동 거리
const SPAWN_Z = 5.5; // 처음 서 있는 자리(앞쪽)
const LOCKER_COUNT = 30; // 팀원 최대 인원만큼 (나중에는 실제 팀원 수에 맞춘다)
// 전술 구역: 화이트보드 앞 바닥. 이 안에 들어가면 "전술판 함께 보기 / 전술 설명하기" 버튼이 뜬다.
const ZONE = { x: 0, z: -5.2, w: 7, d: 3.2 };
const ZOOM_DEFAULT = 1.4;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.2;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));

// i번째 락커 자리: 뒷벽 10개(가운데는 화이트보드 자리) + 왼쪽 벽 10개 + 오른쪽 벽 10개
function lockerSlot(i: number): { position: [number, number, number]; rotY: number } {
  if (i < 10) {
    const x = i < 5 ? -9.6 + i * 1.55 : 3.4 + (i - 5) * 1.55;
    return { position: [x, 1.15, -ROOM_D / 2 + 0.35], rotY: 0 };
  }
  const j = (i - 10) % 10;
  const z = -6 + j * 1.33;
  return i < 20
    ? { position: [-ROOM_W / 2 + 0.35, 1.15, z], rotY: Math.PI / 2 }
    : { position: [ROOM_W / 2 - 0.35, 1.15, z], rotY: -Math.PI / 2 };
}

const BALL_COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#ec4899", "#f8fafc"];

function clampToRoom(x: number, z: number) {
  return {
    x: Math.min(LIMIT_X, Math.max(-LIMIT_X, x)),
    z: Math.min(LIMIT_Z_MAX, Math.max(LIMIT_Z_MIN, z)),
  };
}

// 각도 a를 b쪽으로 가장 짧은 방향으로 t만큼 돌린다
function lerpAngle(a: number, b: number, t: number) {
  const diff = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}

// 축구공 무늬(흰 바탕 + 검은 오각형) 텍스처. 재질 색을 곱하면 무늬는 그대로 두고 흰 부분만 그 색이 된다.
function makeBallTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1f2937";
  const pentagon = (cx: number, cy: number, r: number, stretchX: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
      const x = cx + Math.cos(a) * r * stretchX;
      const y = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  };
  for (let i = 0; i < 5; i++) pentagon((i + 0.5) * (w / 5), h * 0.5, 24, 1);
  for (let i = 0; i < 5; i++) {
    pentagon((i + 1) * (w / 5), h * 0.2, 20, 1.6);
    pentagon((i + 1) * (w / 5), h * 0.8, 20, 1.6);
  }
  ctx.fillRect(0, 0, w, h * 0.06);
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
  // 얼굴이 놓이는 앞면(u=0.25 부근)은 무늬를 지우고 깨끗한 흰 바탕으로 둔다
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(w * 0.25, h * 0.46, w * 0.16, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// ── 3D 공간 안의 글자표(이름표·번호표). drei의 Html은 React 19 개발 모드에서 루트 충돌 오류가 나서, 캔버스 텍스처 스프라이트로 그린다 ──
function Label({
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

const BUBBLE_MS = 6000; // 말풍선이 떠 있는 시간

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
function Bubble({ text }: { text: string }) {
  const { texture, wCss, hCss } = useMemo(() => makeBubbleTexture(text), [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  const k = 0.0055; // 화면 픽셀 → 월드 크기
  return (
    <sprite position={[0, 1.82, 0]} center={[0.5, 0]} scale={[wCss * k, hCss * k, 1]} renderOrder={11} raycast={() => null}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}

// ── 캐릭터: 축구공 몸통 + 팔다리 ──
function BallPlayer({
  color,
  name,
  posRef,
  targetRef,
  initial = [0, SPAWN_Z],
  bubble = null,
}: {
  color: string;
  name: string;
  posRef: MutableRefObject<THREE.Vector3>;
  targetRef: MutableRefObject<THREE.Vector3 | null>;
  initial?: [number, number]; // 처음 서는 자리 [x, z] — 마운트할 때 한 번만 쓰인다
  bubble?: string | null; // 머리 위에 띄울 말풍선 글
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const facing = useRef(0);

  const texture = useMemo(() => makeBallTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const limbColor = useMemo(() => new THREE.Color(color).multiplyScalar(0.72), [color]);

  useFrame((state, delta) => {
    const g = root.current;
    if (!g) return;
    const dt = Math.min(delta, 0.05);

    // 이동: 목표 지점을 향해 일정 속도로 걷는다
    let moving = false;
    const target = targetRef.current;
    if (target) {
      const dx = target.x - g.position.x;
      const dz = target.z - g.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.06) {
        targetRef.current = null;
      } else {
        moving = true;
        const step = Math.min(SPEED * dt, dist);
        g.position.x += (dx / dist) * step;
        g.position.z += (dz / dist) * step;
        facing.current = lerpAngle(facing.current, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt));
      }
    }
    g.rotation.y = facing.current;
    posRef.current.copy(g.position);

    // 애니메이션: 걷는 동안 다리·팔을 번갈아 흔들고, 몸통은 통통 튀며 앞으로 살짝 기울인다
    if (moving) phase.current += dt * SPEED * 2.6;
    const swing = moving ? Math.sin(phase.current) * 0.9 : 0;
    const damp = THREE.MathUtils.damp;
    if (legL.current) legL.current.rotation.x = damp(legL.current.rotation.x, swing, 16, dt);
    if (legR.current) legR.current.rotation.x = damp(legR.current.rotation.x, -swing, 16, dt);
    if (armL.current) armL.current.rotation.x = damp(armL.current.rotation.x, -swing * 0.8, 16, dt);
    if (armR.current) armR.current.rotation.x = damp(armR.current.rotation.x, swing * 0.8, 16, dt);
    if (body.current) {
      const bounce = moving ? Math.abs(Math.sin(phase.current)) * 0.09 : 0;
      body.current.position.y = damp(body.current.position.y, bounce, 14, dt);
      body.current.rotation.x = damp(body.current.rotation.x, moving ? 0.12 : 0, 10, dt);
      // 서 있을 때는 숨 쉬듯 아주 조금 커졌다 작아진다
      const breath = moving ? 1 : 1 + Math.sin(state.clock.elapsedTime * 2) * 0.015;
      body.current.scale.y = damp(body.current.scale.y, breath, 10, dt);
    }
  });

  return (
    <group ref={root} position={[initial[0], 0, initial[1]]}>
      {/* 바닥 그림자 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={() => null}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} />
      </mesh>

      <group ref={body}>
        {/* 몸통(공) */}
        <mesh position={[0, 0.66, 0]}>
          <sphereGeometry args={[0.45, 32, 24]} />
          <meshStandardMaterial map={texture} color={color} roughness={0.55} />
        </mesh>
        {/* 얼굴: 큰 눈(반짝이 포함) + 볼터치 + 작은 코 + 웃는 입 */}
        {([-1, 1] as const).map(side => (
          <group key={side} position={[side * 0.16, 0.78, 0.4]}>
            <mesh scale={[1, 1.3, 0.55]}>
              <sphereGeometry args={[0.075, 16, 16]} />
              <meshBasicMaterial color="#111827" />
            </mesh>
            <mesh position={[0.025, 0.04, 0.045]}>
              <sphereGeometry args={[0.026, 10, 10]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          </group>
        ))}
        {([-1, 1] as const).map(side => (
          <mesh key={side} position={[side * 0.28, 0.66, 0.34]} scale={[1.2, 0.7, 0.3]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial color="#fb7185" transparent opacity={0.65} />
          </mesh>
        ))}
        <mesh position={[0, 0.7, 0.445]}>
          <sphereGeometry args={[0.03, 10, 10]} />
          <meshBasicMaterial color="#7c2d12" />
        </mesh>
        <mesh position={[0, 0.63, 0.435]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.07, 0.014, 8, 20, Math.PI]} />
          <meshBasicMaterial color="#7f1d1d" />
        </mesh>
        {/* 다리 */}
        <group ref={legL} position={[-0.17, 0.3, 0]}>
          <mesh position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.09, 0.14, 6, 12]} />
            <meshStandardMaterial color={limbColor} roughness={0.7} />
          </mesh>
          {/* 축구화 */}
          <mesh position={[0, -0.27, 0.05]} scale={[1, 0.6, 1.5]}>
            <sphereGeometry args={[0.105, 14, 12]} />
            <meshStandardMaterial color="#1f2937" roughness={0.6} />
          </mesh>
        </group>
        <group ref={legR} position={[0.17, 0.3, 0]}>
          <mesh position={[0, -0.15, 0]}>
            <capsuleGeometry args={[0.09, 0.14, 6, 12]} />
            <meshStandardMaterial color={limbColor} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.27, 0.05]} scale={[1, 0.6, 1.5]}>
            <sphereGeometry args={[0.105, 14, 12]} />
            <meshStandardMaterial color="#1f2937" roughness={0.6} />
          </mesh>
        </group>
        {/* 팔 */}
        <group position={[-0.5, 0.74, 0]} rotation={[0, 0, 0.35]}>
          <group ref={armL}>
            <mesh position={[0, -0.14, 0]}>
              <capsuleGeometry args={[0.075, 0.14, 6, 12]} />
              <meshStandardMaterial color={limbColor} roughness={0.7} />
            </mesh>
          </group>
        </group>
        <group position={[0.5, 0.74, 0]} rotation={[0, 0, -0.35]}>
          <group ref={armR}>
            <mesh position={[0, -0.14, 0]}>
              <capsuleGeometry args={[0.075, 0.14, 6, 12]} />
              <meshStandardMaterial color={limbColor} roughness={0.7} />
            </mesh>
          </group>
        </group>
      </group>

      <Label text={name} position={[0, 1.6, 0]} height={0.3} onTop />
      {bubble && <Bubble text={bubble} />}
    </group>
  );
}

// ── 같은 방의 다른 사람: 받은 "출발점 + 목표 지점"대로 같은 속도로 걸어간다 ──
function RemotePlayer({ other, bubble }: { other: OtherPlayer; bubble: string | null }) {
  const initial = useRef<[number, number]>([other.x, other.z]).current; // 처음 나타난 자리 (이후 상태가 바뀌어도 고정)
  const posRef = useRef(new THREE.Vector3(other.x, 0, other.z));
  const targetRef = useRef<THREE.Vector3 | null>(null);
  // 새 이동(seq가 바뀜)이 오면 목표만 바꾼다. 지금 보이는 위치에서 이어서 걸어가므로 순간이동하지 않는다.
  useEffect(() => {
    if (other.tx !== null && other.tz !== null) targetRef.current = new THREE.Vector3(other.tx, 0, other.tz);
  }, [other.seq, other.tx, other.tz]);
  return <BallPlayer color={other.color} name={other.name} posRef={posRef} targetRef={targetRef} initial={initial} bubble={bubble} />;
}

// ── 화면 아래 최근 대화 (최근 20초 안의 것 최대 3줄) ──
function ChatLines({ messages }: { messages: ChatMessage[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!messages.length) return;
    const t = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(t);
  }, [messages.length]);
  const recent = messages.filter(m => now - m.at < 20000).slice(-3);
  if (!recent.length) return null;
  return (
    <div className="w-full max-w-sm flex flex-col items-start gap-1 pointer-events-none">
      {recent.map(m => (
        <div key={m.id} className="px-3 py-1 rounded-2xl bg-black/60 text-sm text-white max-w-full break-words">
          <span className={`font-bold mr-1.5 ${m.mine ? "text-emerald-300" : "text-sky-300"}`}>{m.mine ? "나" : m.name}</span>
          {m.text}
        </div>
      ))}
    </div>
  );
}

// ── 탭한 자리에 퍼지는 링 ──
function TargetMarker({ x, z }: { x: number; z: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const born = useRef<number | null>(null);
  useFrame((state) => {
    if (born.current === null) born.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - born.current;
    const k = Math.min(t / 0.7, 1);
    if (mesh.current) mesh.current.scale.setScalar(1 + k * 1.6);
    if (mat.current) mat.current.opacity = 0.9 * (1 - k);
  });
  return (
    <mesh ref={mesh} position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[0.16, 0.24, 32]} />
      <meshBasicMaterial ref={mat} color="#34d399" transparent opacity={0.9} />
    </mesh>
  );
}

// ── 전술 구역 표시(바닥의 초록 영역). 안에 들어가 있으면 더 밝게 깜빡인다 ──
function ZoneMarker({ active }: { active: boolean }) {
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    if (!fill.current) return;
    fill.current.opacity = active ? 0.34 + Math.sin(state.clock.elapsedTime * 4) * 0.06 : 0.16;
  });
  const t = 0.09; // 테두리 두께
  const edges: [number, number, number, number][] = [
    [0, -ZONE.d / 2, ZONE.w, t],
    [0, ZONE.d / 2, ZONE.w, t],
    [-ZONE.w / 2, 0, t, ZONE.d],
    [ZONE.w / 2, 0, t, ZONE.d],
  ];
  return (
    <group position={[ZONE.x, 0.02, ZONE.z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[ZONE.w, ZONE.d]} />
        <meshBasicMaterial ref={fill} color="#5f9e78" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      {edges.map(([x, z, w, d], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, z]} raycast={() => null}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial color={active ? "#a3c9ac" : "#5f9e78"} />
        </mesh>
      ))}
      <Label text="전술 구역" position={[0, 0.5, ZONE.d / 2 + 0.15]} height={0.3} bg="#3f7f5c" fg="#ffffff" />
    </group>
  );
}

// 내 캐릭터가 전술 구역 안에 있는지 매 프레임 확인하고, 들어가거나 나올 때만 알린다
function ZoneWatcher({ posRef, onChange }: { posRef: MutableRefObject<THREE.Vector3>; onChange: (inside: boolean) => void }) {
  const last = useRef(false);
  useFrame(() => {
    const p = posRef.current;
    const inside = Math.abs(p.x - ZONE.x) <= ZONE.w / 2 && Math.abs(p.z - ZONE.z) <= ZONE.d / 2;
    if (inside !== last.current) {
      last.current = inside;
      onChange(inside);
    }
  });
  return null;
}

// ── 내 캐릭터를 따라가는 카메라 ──
function CameraRig({ posRef, zoomRef }: { posRef: MutableRefObject<THREE.Vector3>; zoomRef: MutableRefObject<number> }) {
  const look = useRef(new THREE.Vector3(0, 0.8, SPAWN_Z));
  const desired = useRef(new THREE.Vector3());
  useFrame(({ camera }, delta) => {
    const k = 1 - Math.exp(-4 * Math.min(delta, 0.05));
    const p = posRef.current;
    // zoom이 클수록 카메라가 멀어진다(축소). 핀치·휠로 바뀐다.
    desired.current.set(p.x, 6.2 * zoomRef.current, p.z + 7.2 * zoomRef.current);
    camera.position.lerp(desired.current, k);
    look.current.lerp(new THREE.Vector3(p.x, 0.8, p.z - 0.4), k);
    camera.lookAt(look.current);
  });
  return null;
}

// ── 락커룸 ──
function Locker({ index, onInfo }: { index: number; onInfo: (msg: string) => void }) {
  const slot = lockerSlot(index);
  const body = index % 2 === 0 ? "#3d7a5b" : "#336a4e";
  return (
    <group
      position={slot.position}
      rotation={[0, slot.rotY, 0]}
      onClick={(e) => {
        if (e.delta > 8) return;
        e.stopPropagation();
        onInfo(`${index + 1}번 락커 — 곧 팀원 정보가 연결돼요`);
      }}
    >
      <mesh>
        <boxGeometry args={[1.0, 2.3, 0.7]} />
        <meshStandardMaterial color={body} roughness={0.6} metalness={0.15} />
      </mesh>
      {/* 문 홈과 손잡이 */}
      <mesh position={[0, 0, 0.355]}>
        <boxGeometry args={[0.86, 2.1, 0.02]} />
        <meshStandardMaterial color="#2c5c44" roughness={0.7} />
      </mesh>
      <mesh position={[0.28, -0.1, 0.38]}>
        <boxGeometry args={[0.05, 0.3, 0.04]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.6} roughness={0.3} />
      </mesh>
      <Label text={String(index + 1)} position={[0, 0.82, 0.42]} height={0.34} bg="rgba(255,255,255,0.92)" fg="#111827" />
    </group>
  );
}

function Room({ onFloorTap, onInfo }: { onFloorTap: (x: number, z: number) => void; onInfo: (msg: string) => void }) {
  return (
    <group>
      {/* 바닥 */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 8) return;
          e.stopPropagation();
          onFloorTap(e.point.x, e.point.z);
        }}
      >
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#2b3441" roughness={0.9} />
      </mesh>
      {/* 가운데 초록 매트 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0.5]} raycast={() => null}>
        <planeGeometry args={[12, 6.4]} />
        <meshStandardMaterial color="#14532d" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.5]} raycast={() => null}>
        <ringGeometry args={[1.25, 1.34, 48]} />
        <meshBasicMaterial color="#86efac" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.5]} raycast={() => null}>
        <planeGeometry args={[0.1, 6.4]} />
        <meshBasicMaterial color="#86efac" />
      </mesh>

      {/* 뒷벽·양옆 벽 (앞쪽은 카메라가 보도록 비워 둔다) */}
      <mesh position={[0, WALL_H / 2, -ROOM_D / 2]} raycast={() => null}>
        <boxGeometry args={[ROOM_W, WALL_H, 0.2]} />
        <meshStandardMaterial color="#1f2937" roughness={0.95} />
      </mesh>
      <mesh position={[-ROOM_W / 2, WALL_H / 2, 0]} raycast={() => null}>
        <boxGeometry args={[0.2, WALL_H, ROOM_D]} />
        <meshStandardMaterial color="#1b2432" roughness={0.95} />
      </mesh>
      <mesh position={[ROOM_W / 2, WALL_H / 2, 0]} raycast={() => null}>
        <boxGeometry args={[0.2, WALL_H, ROOM_D]} />
        <meshStandardMaterial color="#1b2432" roughness={0.95} />
      </mesh>

      {/* 락커: 팀원 최대 인원만큼 */}
      {Array.from({ length: LOCKER_COUNT }, (_, i) => (
        <Locker key={i} index={i} onInfo={onInfo} />
      ))}

      {/* 뒷벽 가운데: 전술 화이트보드 */}
      <group
        position={[0, 1.95, -ROOM_D / 2 + 0.15]}
        onClick={(e) => {
          if (e.delta > 8) return;
          e.stopPropagation();
          onInfo("전술 화이트보드 — 곧 전술판이 연결돼요");
        }}
      >
        <mesh>
          <boxGeometry args={[4.8, 2.4, 0.1]} />
          <meshStandardMaterial color="#e5e7eb" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.055]}>
          <planeGeometry args={[4.6, 2.2]} />
          <meshStandardMaterial color="#166534" roughness={0.6} />
        </mesh>
        {/* 보드 위 경기장 선 */}
        <mesh position={[0, 0, 0.06]}>
          <ringGeometry args={[0.35, 0.4, 32]} />
          <meshBasicMaterial color="#f0fdf4" />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[0.05, 2.2]} />
          <meshBasicMaterial color="#f0fdf4" />
        </mesh>
        <Label text="전술 화이트보드" position={[0, 1.55, 0.14]} height={0.34} bg="#3f7f5c" fg="#ffffff" />
      </group>

      {/* 왼쪽 앞: 게시판 (세워 둔 보드) */}
      <group
        position={[-8.5, 0, 2.2]}
        onClick={(e) => {
          if (e.delta > 8) return;
          e.stopPropagation();
          onInfo("게시판 — 곧 일정과 공지가 연결돼요");
        }}
      >
        <mesh position={[-0.9, 0.7, 0]}>
          <boxGeometry args={[0.1, 1.4, 0.1]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
        <mesh position={[0.9, 0.7, 0]}>
          <boxGeometry args={[0.1, 1.4, 0.1]} />
          <meshStandardMaterial color="#4b5563" />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[2.4, 1.5, 0.1]} />
          <meshStandardMaterial color="#a16207" roughness={0.9} />
        </mesh>
        <Label text="게시판" position={[0, 2.55, 0.1]} height={0.32} bg="#fbbf24" fg="#1c1203" />
      </group>

      {/* 벤치 두 개 */}
      {[-5.5, 5.5].map(bx => (
        <group key={bx} position={[bx, 0.3, 3.4]} raycast={() => null}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[3.2, 0.14, 0.6]} />
            <meshStandardMaterial color="#9a6b3f" roughness={0.8} />
          </mesh>
          <mesh position={[-1.3, -0.05, 0]}>
            <boxGeometry args={[0.12, 0.5, 0.5]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <mesh position={[1.3, -0.05, 0]}>
            <boxGeometry args={[0.12, 0.5, 0.5]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function LoungeScene({ canManage }: { canManage: boolean }) {
  const [color, setColor] = useState(BALL_COLORS[0]);
  const [inZone, setInZone] = useState(false);
  const [panel, setPanel] = useState<TacticsMode | null>(null);
  const leaderboard = useLeaderboard(); // 득점왕·도움왕·참석왕 (명예의 전당 보드)
  const [showBoard, setShowBoard] = useState(false);
  // 관리자급(감독·코치·관리자 등)이면 "전술 설명하기"가 보인다. 개발 중에는 아래 칩으로 관리자/팀원을 바꿔 볼 수 있다.
  const [asManager, setAsManager] = useState(canManage);
  const [marker, setMarker] = useState<{ x: number; z: number; id: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const posRef = useRef(new THREE.Vector3(0, 0, SPAWN_Z));
  const zoomRef = useRef(ZOOM_DEFAULT);
  // 핀치 확대·축소: 손가락 두 개의 거리 변화로 카메라 거리를 바꾼다
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const targetRef = useRef<THREE.Vector3 | null>(null);

  // 채팅: 최근 대화 목록 + 머리 위 말풍선(사람별, 일정 시간 뒤 사라짐). 내 말풍선 칸은 "me"
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const bubbleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const handleChat = useCallback((m: ChatMessage) => {
    setMessages(prev => [...prev.slice(-49), m]);
    const slot = m.mine ? "me" : m.key;
    setBubbles(prev => ({ ...prev, [slot]: m.text }));
    const old = bubbleTimers.current.get(slot);
    if (old) clearTimeout(old);
    bubbleTimers.current.set(
      slot,
      setTimeout(() => {
        setBubbles(prev => {
          const next = { ...prev };
          delete next[slot];
          return next;
        });
        bubbleTimers.current.delete(slot);
      }, BUBBLE_MS)
    );
  }, []);
  useEffect(() => {
    const timers = bubbleTimers.current;
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const room = useLoungeRoom({ initial: { color: BALL_COLORS[0], x: 0, z: SPAWN_Z }, clamp: clampToRoom, onChat: handleChat });
  const [draft, setDraft] = useState("");
  const [showColors, setShowColors] = useState(false);
  const [moved, setMoved] = useState(false); // 한 번이라도 걸으면 안내 문구를 숨긴다
  const markerId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const result = room.say(draft);
    if (result === "ok") setDraft("");
    else if (result === "profanity") handleInfo("부적절한 표현이 들어 있어요");
    else if (result === "rate") handleInfo("조금 천천히 보내 주세요");
    else if (result === "offline") handleInfo("아직 연결 중이에요");
  }

  function handleFloorTap(x: number, z: number) {
    setMoved(true);
    const p = clampToRoom(x, z);
    targetRef.current = new THREE.Vector3(p.x, 0, p.z);
    room.announceMove({ x: posRef.current.x, z: posRef.current.z }, p); // 같은 방 사람들에게 "여기서 저기로 걸어간다"고 알림
    markerId.current += 1;
    setMarker({ x: p.x, z: p.z, id: markerId.current });
  }

  function handleInfo(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  return (
    <div
      className="fixed inset-0 bg-gray-950 overflow-hidden"
      style={{ touchAction: "none" }}
      onWheel={(e) => { zoomRef.current = clampZoom(zoomRef.current * (1 + e.deltaY * 0.001)); }}
      onPointerDown={(e) => {
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: zoomRef.current };
        }
      }}
      onPointerMove={(e) => {
        if (!pointers.current.has(e.pointerId)) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 2 && pinch.current) {
          const [a, b] = [...pointers.current.values()];
          const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
          zoomRef.current = clampZoom(pinch.current.zoom * (pinch.current.dist / dist)); // 벌리면 확대(가까이), 모으면 축소
        }
      }}
      onPointerUp={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; }}
      onPointerCancel={(e) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = null; }}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 6.2 * ZOOM_DEFAULT, SPAWN_Z + 7.2 * ZOOM_DEFAULT], fov: 52, near: 0.1, far: 80 }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={["#0b1018"]} />
        <ambientLight intensity={0.9} />
        <hemisphereLight args={["#bfdbfe", "#1f2937", 0.6]} />
        <directionalLight position={[4, 9, 6]} intensity={1.4} />
        <pointLight position={[-6, 3.2, -2]} intensity={14} distance={16} color="#fde68a" />
        <pointLight position={[6, 3.2, -2]} intensity={14} distance={16} color="#fde68a" />
        <Room onFloorTap={handleFloorTap} onInfo={handleInfo} />
        <HallOfFameBoard
          position={[8.4, 0, 1.2]}
          data={leaderboard.data}
          status={leaderboard.status}
          onTap={() => { leaderboard.refreshIfStale(); setShowBoard(true); }}
        />
        <ZoneMarker active={inZone} />
        <ZoneWatcher posRef={posRef} onChange={setInZone} />
        {marker && <TargetMarker key={marker.id} x={marker.x} z={marker.z} />}
        <BallPlayer color={color} name="나" posRef={posRef} targetRef={targetRef} bubble={bubbles.me ?? null} />
        {room.others.map(o => (
          <RemotePlayer key={o.key} other={o} bubble={bubbles[o.key] ?? null} />
        ))}
        <CameraRig posRef={posRef} zoomRef={zoomRef} />
      </Canvas>

      {/* 화면 위 UI */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)]">
        <Link href="/dashboard" className="px-3 py-1.5 rounded-full bg-black/55 text-white text-sm font-bold">← 나가기</Link>
        <span className="px-3 py-1.5 rounded-full bg-black/55 text-emerald-300 text-xs font-bold">팀 라운지 (시험 중)</span>
      </div>

      <div className="absolute left-4 top-16 px-2.5 py-1 rounded-full bg-black/55 text-[11px] font-bold flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${room.status === "online" ? "bg-emerald-400" : room.status === "error" ? "bg-red-500" : "bg-amber-400"}`} />
        <span className="text-white">
          {room.status === "online" ? `${room.others.length + 1}명 접속 중` : room.status === "error" ? "연결 실패" : "연결 중…"}
        </span>
      </div>

      {process.env.NODE_ENV === "development" && (
        <button
          onClick={() => setAsManager(v => !v)}
          className="absolute right-4 top-16 px-2.5 py-1 rounded-full bg-fuchsia-600/80 text-white text-[11px] font-bold"
        >
          개발용: {asManager ? "관리자로" : "팀원으로"} 보기
        </button>
      )}

      {panel && <TacticsSessionPanel mode={panel} onClose={() => setPanel(null)} />}
      {showBoard && <LeaderboardModal data={leaderboard.data} status={leaderboard.status} onClose={() => setShowBoard(false)} />}

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-24 px-4 py-2 rounded-xl bg-black/75 text-white text-sm font-medium max-w-[80%] text-center">{toast}</div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-[max(env(safe-area-inset-bottom),16px)] flex flex-col items-center gap-2.5 pointer-events-none">
        {inZone && !panel && (
          <div className="flex flex-col items-center gap-2 pointer-events-auto">
            <p className="text-emerald-300 text-xs font-bold bg-black/55 px-3 py-1 rounded-full">전술 구역</p>
            <div className="flex gap-2">
              {asManager && (
                <button onClick={() => setPanel("present")} className="bg-emerald-500 text-black font-black text-sm px-4 py-2.5 rounded-xl shadow-lg">
                  🎤 전술 설명하기
                </button>
              )}
              <button
                onClick={() => setPanel("watch")}
                className={`font-black text-sm px-4 py-2.5 rounded-xl shadow-lg ${asManager ? "bg-gray-800 text-white border border-white/15" : "bg-emerald-500 text-black"}`}
              >
                👀 {asManager ? "함께 보기" : "전술판 함께 보기"}
              </button>
            </div>
          </div>
        )}
        {!moved && <p className="text-gray-300 text-xs bg-black/45 px-3 py-1 rounded-full">바닥을 탭하면 그곳으로 걸어가요</p>}
        <ChatLines messages={messages} />
        {showColors && (
          <div className="flex gap-2 bg-black/60 rounded-full px-3 py-2 pointer-events-auto">
            {BALL_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); room.announceColor(c); }}
                aria-label={`공 색 ${c}`}
                className={`w-7 h-7 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        )}
        <form onSubmit={handleSend} className="w-full max-w-sm flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => setShowColors(v => !v)}
            aria-label="공 색 바꾸기"
            className="w-10 h-10 shrink-0 rounded-full bg-black/60 flex items-center justify-center text-lg"
          >
            🎨
          </button>
          {/* 글자 크기 16px: 그보다 작으면 iPhone이 입력창을 누를 때 화면을 확대해 버린다 */}
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            maxLength={MAX_CHAT_LENGTH}
            placeholder="생각을 남겨보세요"
            enterKeyHint="send"
            autoComplete="off"
            className="flex-1 min-w-0 h-10 rounded-full bg-black/60 text-white text-base px-4 placeholder:text-gray-400 outline-none focus:ring-1 focus:ring-white/30"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-10 px-4 shrink-0 rounded-full bg-emerald-500 text-black font-bold text-sm disabled:opacity-40"
          >
            전송
          </button>
        </form>
      </div>
    </div>
  );
}
