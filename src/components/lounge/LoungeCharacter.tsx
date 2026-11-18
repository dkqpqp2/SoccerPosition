"use client";

import { useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Bubble, Label } from "./LoungeLabels";
import { SPAWN_Z, SPEED, lerpAngle } from "./loungeConstants";

const INK = "#141b2d"; // 윤곽선·팔다리의 진한 남색
const JERSEY = "#3f7f5c"; // 몸(유니폼) 색 — 나중에 팀 색으로 바꿀 수 있다

// 머리 그림: 흰 바탕에 검은 점 눈 두 개(코·입 없음). 재질 색을 곱하면 눈은 검게 두고 바탕만 고른 머리색이 된다.
// 눈은 머리 그림에 직접 그려서 눈 부품(그리기 호출)이 따로 필요 없다.
function makeFaceTexture(): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#0f172a";
  // 구의 앞쪽 중심은 가로 25% 지점. 위에서 내려다보는 카메라라서 눈을 적도보다 살짝 위에 두어야 얼굴 한가운데로 보인다
  for (const du of [-0.05, 0.05]) {
    ctx.beginPath();
    ctx.arc(w * (0.25 + du), h * 0.45, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

// 모든 캐릭터가 함께 쓰는 모양·재질: 캐릭터마다 새로 만들지 않으므로 30명이어도 GPU 메모리와 준비 시간이 거의 늘지 않는다.
function createShared() {
  return {
    head: new THREE.SphereGeometry(0.48, 24, 18),
    body: new THREE.CapsuleGeometry(0.22, 0.16, 4, 10),
    leg: new THREE.CapsuleGeometry(0.075, 0.07, 3, 8),
    arm: new THREE.CapsuleGeometry(0.06, 0.1, 3, 8),
    shadow: new THREE.CircleGeometry(0.5, 20),
    faceTexture: makeFaceTexture(),
    outlineMat: new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), // 뒷면만 그려서 윤곽선처럼 보이게 하는 껍데기
    inkMat: new THREE.MeshStandardMaterial({ color: INK, roughness: 0.8 }),
    jerseyMat: new THREE.MeshStandardMaterial({ color: JERSEY, roughness: 0.7 }),
    shadowMat: new THREE.MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.28 }),
    headMats: new Map<string, THREE.MeshStandardMaterial>(), // 머리색별로 하나씩만
  };
}
let shared: ReturnType<typeof createShared> | null = null;
function getShared() {
  return (shared ??= createShared());
}
function headMaterial(color: string) {
  const s = getShared();
  let m = s.headMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: s.faceTexture, color, roughness: 0.6 });
    s.headMats.set(color, m);
  }
  return m;
}

/**
 * 라운지 캐릭터: 둥근 큰 머리 + 점 눈 + 작은 몸 + 굵은 윤곽선.
 * 목표 지점(targetRef)을 향해 일정 속도로 걷고, 걷는 동안 몸이 통통 튀며 머리가 살짝 좌우로 흔들린다.
 * 공유 모양·재질을 쓰는 메쉬에는 dispose={null}을 달아서, 캐릭터 하나가 사라질 때 다른 캐릭터의 모양까지 지워지지 않게 한다.
 */
export default function Character({
  color,
  name,
  posRef,
  targetRef,
  initial = [0, SPAWN_Z],
  bubble = null,
}: {
  color: string; // 머리색
  name: string;
  posRef: MutableRefObject<THREE.Vector3>;
  targetRef: MutableRefObject<THREE.Vector3 | null>;
  initial?: [number, number]; // 처음 서는 자리 [x, z] — 마운트할 때 한 번만 쓰인다
  bubble?: string | null; // 머리 위에 띄울 말풍선 글
}) {
  const s = getShared();
  const root = useRef<THREE.Group>(null);
  const bodyG = useRef<THREE.Group>(null);
  const headG = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const facing = useRef(0);

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

    // 애니메이션: 걷는 동안 팔다리를 번갈아 흔들고, 몸은 통통 튀며, 머리는 좌우로 살짝 갸우뚱
    if (moving) phase.current += dt * SPEED * 2.6;
    const swing = moving ? Math.sin(phase.current) * 0.9 : 0;
    const damp = THREE.MathUtils.damp;
    if (legL.current) legL.current.rotation.x = damp(legL.current.rotation.x, swing, 16, dt);
    if (legR.current) legR.current.rotation.x = damp(legR.current.rotation.x, -swing, 16, dt);
    if (armL.current) armL.current.rotation.x = damp(armL.current.rotation.x, -swing * 0.8, 16, dt);
    if (armR.current) armR.current.rotation.x = damp(armR.current.rotation.x, swing * 0.8, 16, dt);
    if (bodyG.current) {
      const bounce = moving ? Math.abs(Math.sin(phase.current)) * 0.08 : 0;
      bodyG.current.position.y = damp(bodyG.current.position.y, bounce, 14, dt);
      bodyG.current.rotation.x = damp(bodyG.current.rotation.x, moving ? 0.1 : 0, 10, dt);
      // 서 있을 때는 숨 쉬듯 아주 조금 커졌다 작아진다
      const breath = moving ? 1 : 1 + Math.sin(state.clock.elapsedTime * 2) * 0.012;
      bodyG.current.scale.y = damp(bodyG.current.scale.y, breath, 10, dt);
    }
    if (headG.current) {
      const roll = moving ? Math.sin(phase.current) * 0.07 : Math.sin(state.clock.elapsedTime * 1.3) * 0.02;
      headG.current.rotation.z = damp(headG.current.rotation.z, roll, 12, dt);
    }
  });

  return (
    <group ref={root} position={[initial[0], 0, initial[1]]}>
      {/* 바닥 그림자 */}
      <mesh geometry={s.shadow} material={s.shadowMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]} raycast={() => null} dispose={null} />

      <group ref={bodyG}>
        {/* 머리 + 윤곽선 */}
        <group ref={headG} position={[0, 0.98, 0]}>
          <mesh geometry={s.head} material={headMaterial(color)} dispose={null} />
          <mesh geometry={s.head} material={s.outlineMat} scale={1.07} dispose={null} />
        </group>
        {/* 몸(유니폼) + 윤곽선 */}
        <mesh geometry={s.body} material={s.jerseyMat} position={[0, 0.36, 0]} dispose={null} />
        <mesh geometry={s.body} material={s.outlineMat} position={[0, 0.36, 0]} scale={1.12} dispose={null} />
        {/* 다리 */}
        <group ref={legL} position={[-0.12, 0.2, 0]}>
          <mesh geometry={s.leg} material={s.inkMat} position={[0, -0.1, 0]} dispose={null} />
        </group>
        <group ref={legR} position={[0.12, 0.2, 0]}>
          <mesh geometry={s.leg} material={s.inkMat} position={[0, -0.1, 0]} dispose={null} />
        </group>
        {/* 팔 */}
        <group position={[-0.27, 0.46, 0]} rotation={[0, 0, 0.5]}>
          <group ref={armL}>
            <mesh geometry={s.arm} material={s.inkMat} position={[0, -0.1, 0]} dispose={null} />
          </group>
        </group>
        <group position={[0.27, 0.46, 0]} rotation={[0, 0, -0.5]}>
          <group ref={armR}>
            <mesh geometry={s.arm} material={s.inkMat} position={[0, -0.1, 0]} dispose={null} />
          </group>
        </group>
      </group>

      <Label text={name} position={[0, 1.84, 0]} height={0.3} onTop />
      {bubble && <Bubble text={bubble} />}
    </group>
  );
}
