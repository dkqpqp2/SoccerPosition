"use client";

import { memo, useCallback, useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import Link from "next/link";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import TacticsSessionPanel, { type TacticsMode } from "./TacticsSessionPanel";
import { MAX_CHAT_LENGTH, useLoungeRoom, type ChatMessage, type OtherPlayer } from "./useLoungeRoom";
import { sameRender, seatRival } from "./presenceList";
import ChatPanel from "./ChatPanel";
import Character from "./LoungeCharacter";
import { BUBBLE_MS, Label } from "./LoungeLabels";
import { BENCH_CENTERS, BENCH_LENGTH, HEAD_COLORS, SEATS_PER_BENCH, SPAWN_Z, seatPosition } from "./loungeConstants";
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

function clampToRoom(x: number, z: number) {
  return {
    x: Math.min(LIMIT_X, Math.max(-LIMIT_X, x)),
    z: Math.min(LIMIT_Z_MAX, Math.max(LIMIT_Z_MIN, z)),
  };
}

// ── 같은 방의 다른 사람: 받은 "출발점 + 목표 지점"대로 같은 속도로 걸어간다 ──
// memo: 이 사람의 모양(이름·색·이동)이나 말풍선이 바뀔 때만 다시 계산한다. 다른 사람이 움직이거나 화면의 다른 상태가 바뀌어도 30명 전체를 다시 계산하지 않는다.
const RemotePlayer = memo(function RemotePlayer({ other, bubble }: { other: OtherPlayer; bubble: string | null }) {
  const initial = useRef<[number, number]>([other.x, other.z]).current; // 처음 나타난 자리 (이후 상태가 바뀌어도 고정)
  const posRef = useRef(new THREE.Vector3(other.x, 0, other.z));
  const targetRef = useRef<THREE.Vector3 | null>(null);
  // 새 이동(seq가 바뀜)이 오면 목표만 바꾼다. 지금 보이는 위치에서 이어서 걸어가므로 순간이동하지 않는다.
  useEffect(() => {
    if (other.tx !== null && other.tz !== null) targetRef.current = new THREE.Vector3(other.tx, 0, other.tz);
  }, [other.seq, other.tx, other.tz]);
  return <Character color={other.color} name={other.name} posRef={posRef} targetRef={targetRef} initial={initial} bubble={bubble} seat={other.seat} />;
}, (a, b) => a.bubble === b.bubble && sameRender(a.other, b.other));

// ── 개발 전용 성능 시험: 주소에 ?fake=30 을 붙이면 가상 캐릭터 30명이 방 안을 걸어 다닌다 (운영에서는 동작하지 않음) ──
// 1초마다 접속자 목록을 통째로 새로 만들고(실제 접속 동기화처럼), 그중 평균 3명만 새 목적지로 보낸다. 나머지는 "살아 있어요" 신호만 바뀐다.
function FakePlayers({ count }: { count: number }) {
  const randomSpot = () => clampToRoom((Math.random() - 0.5) * ROOM_W, (Math.random() - 0.5) * ROOM_D);
  const [list, setList] = useState<OtherPlayer[]>(() =>
    Array.from({ length: count }, (_, i) => {
      const from = randomSpot();
      const to = randomSpot();
      return {
        key: `fake-${i}`, name: `가상${i + 1}`, color: HEAD_COLORS[i % HEAD_COLORS.length],
        x: from.x, z: from.z, tx: to.x, tz: to.z, seq: 1, seat: null, beat: 0, sayId: 0, says: [],
      };
    })
  );
  useEffect(() => {
    const t = setInterval(() => {
      setList(prev =>
        prev.map(p => {
          if (Math.random() < 3 / prev.length) {
            const to = randomSpot();
            return { ...p, tx: to.x, tz: to.z, seq: p.seq + 1 };
          }
          return { ...p, beat: p.beat + 1 };
        })
      );
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <>{list.map(o => <RemotePlayer key={o.key} other={o} bubble={null} />)}</>;
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

function Room({
  onFloorTap,
  onBenchTap,
  onInfo,
}: {
  onFloorTap: (x: number, z: number) => void;
  onBenchTap: (benchIndex: number, pointX: number) => void;
  onInfo: (msg: string) => void;
}) {
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

      {/* 벤치 두 개: 탭하면 가까운 빈 자리로 가서 앉는다 */}
      {BENCH_CENTERS.map(([bx, bz], bi) => (
        <group
          key={bi}
          position={[bx, 0.3, bz]}
          onClick={e => {
            if (e.delta > 8) return;
            e.stopPropagation();
            onBenchTap(bi, e.point.x);
          }}
        >
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[BENCH_LENGTH, 0.14, 0.6]} />
            <meshStandardMaterial color="#9a6b3f" roughness={0.8} />
          </mesh>
          <mesh position={[-BENCH_LENGTH / 2 + 0.3, -0.05, 0]}>
            <boxGeometry args={[0.12, 0.5, 0.5]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
          <mesh position={[BENCH_LENGTH / 2 - 0.3, -0.05, 0]}>
            <boxGeometry args={[0.12, 0.5, 0.5]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export default function LoungeScene({ canManage }: { canManage: boolean }) {
  const [color, setColor] = useState(HEAD_COLORS[0]);
  const [inZone, setInZone] = useState(false);
  const [panel, setPanel] = useState<TacticsMode | null>(null);
  // 개발 전용: 성능 시험용 가상 캐릭터 수 (?fake=30). 운영 빌드에서는 항상 0
  const [fakeCount] = useState(() =>
    process.env.NODE_ENV === "development" && typeof window !== "undefined"
      ? Math.min(60, Math.max(0, Number(new URLSearchParams(window.location.search).get("fake")) || 0))
      : 0
  );
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
  // messages는 이 화면의 메모리에만 있다(DB에 저장하지 않음) → 화면을 나가면 사라진다. 대화창에서 처음부터 볼 수 있게 넉넉히 200개까지 들고 있는다.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false); // 대화창이 열려 있는지
  const [unread, setUnread] = useState(0); // 대화창이 닫혀 있는 동안 도착한 남의 메시지 수
  const chatOpenRef = useRef(false);
  chatOpenRef.current = showChat;
  const [bubbles, setBubbles] = useState<Record<string, string>>({});
  const bubbleTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const handleChat = useCallback((m: ChatMessage) => {
    setMessages(prev => [...prev.slice(-199), m]);
    if (!m.mine && !chatOpenRef.current) setUnread(n => n + 1);
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

  const room = useLoungeRoom({ initial: { color: HEAD_COLORS[0], x: 0, z: SPAWN_Z }, clamp: clampToRoom, onChat: handleChat });
  const [mySeat, setMySeat] = useState<number | null>(null); // 내가 앉은(앉으러 가는) 벤치 자리

  // 같은 자리를 거의 동시에 고른 경우: 접속 키가 작은 쪽이 자리를 갖고, 큰 쪽(나)은 일어나서 벤치 앞으로 나온다.
  // 두 사람이 같은 규칙으로 판단하므로 따로 메시지를 주고받지 않아도 한 명만 양보한다.
  useEffect(() => {
    if (mySeat === null || !seatRival(room.others, mySeat, room.myKey)) return;
    setMySeat(null);
    const sp = seatPosition(mySeat);
    const out = clampToRoom(sp.x, sp.z + 1.3);
    targetRef.current = new THREE.Vector3(out.x, 0, out.z);
    room.announceMove({ x: posRef.current.x, z: posRef.current.z }, out, null);
    handleInfo("다른 사람이 먼저 앉았어요");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.others, room.myKey, mySeat]);

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
    setMySeat(null); // 앉아 있었다면 일어난다
    const p = clampToRoom(x, z);
    targetRef.current = new THREE.Vector3(p.x, 0, p.z);
    room.announceMove({ x: posRef.current.x, z: posRef.current.z }, p, null); // 같은 방 사람들에게 "여기서 저기로 걸어간다"고 알림
    markerId.current += 1;
    setMarker({ x: p.x, z: p.z, id: markerId.current });
  }

  // 벤치를 탭하면: 그 벤치에서 (남이 안 앉은) 탭한 곳에 가장 가까운 자리로 걸어가 앉는다
  function handleBenchTap(benchIndex: number, pointX: number) {
    setMoved(true);
    const taken = new Set<number>();
    for (const o of room.others) if (o.seat !== null) taken.add(o.seat);
    let best: number | null = null;
    let bestDist = Infinity;
    for (let slot = 0; slot < SEATS_PER_BENCH; slot++) {
      const id = benchIndex * SEATS_PER_BENCH + slot;
      if (taken.has(id)) continue;
      const d = Math.abs(seatPosition(id).x - pointX);
      if (d < bestDist) {
        best = id;
        bestDist = d;
      }
    }
    if (best === null) {
      handleInfo("이 벤치는 자리가 없어요");
      return;
    }
    const p = seatPosition(best);
    setMySeat(best);
    targetRef.current = new THREE.Vector3(p.x, 0, p.z);
    room.announceMove({ x: posRef.current.x, z: posRef.current.z }, p, best);
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
        <Room onFloorTap={handleFloorTap} onBenchTap={handleBenchTap} onInfo={handleInfo} />
        <HallOfFameBoard
          position={[8.4, 0, 1.2]}
          data={leaderboard.data}
          status={leaderboard.status}
          onTap={() => { leaderboard.refreshIfStale(); setShowBoard(true); }}
        />
        <ZoneMarker active={inZone} />
        <ZoneWatcher posRef={posRef} onChange={setInZone} />
        {marker && <TargetMarker key={marker.id} x={marker.x} z={marker.z} />}
        <Character color={color} name="나" posRef={posRef} targetRef={targetRef} bubble={bubbles.me ?? null} seat={mySeat} />
        {room.others.map(o => (
          <RemotePlayer key={o.key} other={o} bubble={bubbles[o.key] ?? null} />
        ))}
        {fakeCount > 0 && <FakePlayers count={fakeCount} />}
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

      {showChat && <ChatPanel messages={messages} onClose={() => setShowChat(false)} />}
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
        {!moved && !showChat && <p className="text-gray-300 text-xs bg-black/45 px-3 py-1 rounded-full">바닥을 탭하면 그곳으로 걸어가요</p>}
        {!showChat && <ChatLines messages={messages} />}
        {showColors && (
          <div className="flex gap-2 bg-black/60 rounded-full px-3 py-2 pointer-events-auto">
            {HEAD_COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); room.announceColor(c); }}
                aria-label={`머리색 ${c}`}
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
            aria-label="머리색 바꾸기"
            className="w-10 h-10 shrink-0 rounded-full bg-black/60 flex items-center justify-center text-lg"
          >
            🎨
          </button>
          <button
            type="button"
            onClick={() => { setShowChat(v => !v); setUnread(0); }}
            aria-label={showChat ? "대화창 닫기" : `대화창 열기${unread > 0 ? ` (안 읽은 대화 ${unread}개)` : ""}`}
            className={`relative w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg ${showChat ? "bg-emerald-500" : "bg-black/60"}`}
          >
            💬
            {unread > 0 && !showChat && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
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
