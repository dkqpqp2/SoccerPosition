"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Undo2, Trash2, X, ChevronLeft, ChevronDown, Check, Trash, Save, Download, Wand2, Loader2, LayoutGrid, Play, Square, RotateCcw, Repeat } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ScrimmageSelect from "@/components/ScrimmageSelect";
import PositionSelect from "@/components/PositionSelect";
import { zonePosition, detectFormationName, isGoalkeeper } from "@/lib/tacticsZones";
import { FORMATIONS, PositionSlot } from "@/lib/formations";

type LineMode = "curve" | "straight";
type LineType = "move" | "pass";

const LINE_COLORS: Record<LineType, string> = { move: "#f87171", pass: "#60a5fa" };
const LINE_LABELS: Record<LineType, string> = { move: "움직임", pass: "패스" };

interface Arrow {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  mode: LineMode;
  type: LineType;
}

interface Token {
  id: string;
  x: number;
  y: number;
  team: "us" | "opp" | "ball";
  label?: string;
  pos?: string; // 포지션 코드(GK/CB/CM/ST 등) — label이 선수 이름으로 바뀌어도 색상 구분용으로 유지
  posManual?: boolean; // 사용자가 직접 고른 포지션이면 true — 드래그해도 구역에 따라 자동으로 안 바뀜
}

// assign 페이지와 동일한 포지션별 색상 규칙 (GK 주황 / 수비 파랑 / 공격 빨강 / 미드필드 초록)
function positionColor(pos?: string) {
  const p = (pos ?? "").toUpperCase();
  if (p === "GK") return { bg: "#f59e0b", border: "#fbbf24", color: "#111827" };
  if (/^(CB|LB|RB|LWB|RWB|SW|DC|DL|DR|WB|FB)/.test(p)) return { bg: "#3b82f6", border: "#60a5fa", color: "#ffffff" };
  if (/^(ST|CF|SS|LW|RW|LF|RF|FW|ATT|WG|CW)/.test(p)) return { bg: "#ef4444", border: "#f87171", color: "#ffffff" };
  return { bg: "#10b981", border: "#34d399", color: "#111827" };
}

interface AssignmentSummary {
  id: string;
  session_name: string;
  formation_name: string;
  created_at: string;
  matches: { title: string | null; match_date: string } | null;
}

interface AssignmentDetail {
  formation_name: string;
  formation_slots: PositionSlot[];
  result: Record<string, { name: string } | null>;
}

interface CustomFormation {
  id: string;
  name: string;
  slots: PositionSlot[];
}

const SOCCER_FORMATION_NAMES = Object.keys(FORMATIONS).filter(k => FORMATIONS[k].type === "soccer");

// 기본 포메이션(FORMATIONS) 또는 팀이 직접 만든 커스텀 포메이션(custom_formations)에서 슬롯 배열을 찾음
function getFormationSlots(name: string, customFormations: CustomFormation[]): PositionSlot[] | undefined {
  return FORMATIONS[name]?.slots ?? customFormations.find(f => f.id === name)?.slots;
}

// 우리팀 포메이션과 인원수가 같은 포메이션만 상대 포메이션 후보로 제공 (기본 + 커스텀)
// 인원수가 기본 포메이션의 종목·버킷을 그대로 구분해주므로(축구 11명, 풋살은 버킷마다 인원수가 다 다름) 인원수만 보면 충분
function getMatchingFormationNames(count: number, customFormations: CustomFormation[]): string[] {
  if (!count) return SOCCER_FORMATION_NAMES;
  return [
    ...Object.keys(FORMATIONS).filter(k => FORMATIONS[k].slots.length === count),
    ...customFormations.filter(f => f.slots.length === count).map(f => f.id),
  ];
}

function uid() {
  return Math.random().toString(36).slice(2);
}

// 이모지는 기기마다 모양이 달라서 체크무늬(검은 오각형) 축구공을 SVG로 직접 그림
const BALL_PENTAGON = (cx: number, cy: number, r: number, rotDeg: number) =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((rotDeg + k * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
const BALL_CENTER = BALL_PENTAGON(50, 50, 17, -90);
const BALL_SPOKES = Array.from({ length: 5 }, (_, k) => {
  const a = ((-90 + k * 72) * Math.PI) / 180;
  return { x1: 50 + 17 * Math.cos(a), y1: 50 + 17 * Math.sin(a), x2: 50 + 48 * Math.cos(a), y2: 50 + 48 * Math.sin(a) };
});
const BALL_RIM = Array.from({ length: 5 }, (_, k) => {
  const deg = -54 + k * 72;
  const a = (deg * Math.PI) / 180;
  return BALL_PENTAGON(50 + 52 * Math.cos(a), 50 + 52 * Math.sin(a), 11, deg + 180);
});

function BallIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="block">
      <defs>
        <clipPath id="ball-clip"><circle cx="50" cy="50" r="48" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="#fff" />
      <g clipPath="url(#ball-clip)" fill="#111827" stroke="#111827" strokeWidth="2.5" strokeLinejoin="round">
        {BALL_SPOKES.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} fill="none" />)}
        <polygon points={BALL_CENTER} />
        {BALL_RIM.map((pts, i) => <polygon key={i} points={pts} />)}
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#111827" strokeWidth="3" />
    </svg>
  );
}

// 단계 길이는 거리에 비례: 공은 BALL_SPEED, 선수는 PLAYER_SPEED로 가는 시간 중 더 오래 걸리는 쪽에 맞춰
// 같은 번호의 움직임·패스가 동시에 도착함 (속도 단위: 피치 가로 % / 초)
const BALL_SPEED = 45;
const PLAYER_SPEED = 25;
const MIN_STEP_MS = 800;
const MAX_STEP_MS = 3500;
const EMPTY_STEP_MS = 300;
const MOVER_MAX_DIST = 14; // 움직임 화살표 시작점에서 이 거리(피치 가로 % 기준) 안의 가장 가까운 선수가 그 화살표를 따라 움직임
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

type PlaybackArrow = Pick<Arrow, "x1" | "y1" | "x2" | "y2" | "mode">;

// 피치가 세로로 1.4배 길어서 세로 거리에 1.4를 곱하고, 곡선은 직선보다 조금 더 길게 침
function arrowLength(a: PlaybackArrow) {
  return Math.hypot(a.x2 - a.x1, (a.y2 - a.y1) * 1.4) * (a.mode === "curve" ? 1.1 : 1);
}

function pointOnArrow(a: PlaybackArrow, t: number) {
  if (a.mode === "straight") return { x: a.x1 + (a.x2 - a.x1) * t, y: a.y1 + (a.y2 - a.y1) * t };
  const dx = a.x2 - a.x1;
  const dy = a.y2 - a.y1;
  const len = Math.hypot(dx, dy) || 1;
  const cx = (a.x1 + a.x2) / 2 + (-dy / len) * len * 0.2;
  const cy = (a.y1 + a.y2) / 2 + (dx / len) * len * 0.2;
  const u = 1 - t;
  return { x: u * u * a.x1 + 2 * u * t * cx + t * t * a.x2, y: u * u * a.y1 + 2 * u * t * cy + t * t * a.y2 };
}

interface PlaybackStep {
  moves: { tokenId: string; arrow: Arrow }[];
  pass?: { arrow: Arrow };
  durationMs: number;
}

export default function TacticsBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editable, setEditable] = useState(false);
  const [title, setTitle] = useState("");
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [formationName, setFormationName] = useState("4-3-3");
  const [oppFormationPick, setOppFormationPick] = useState("");
  const [customFormations, setCustomFormations] = useState<CustomFormation[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importList, setImportList] = useState<AssignmentSummary[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [showSaveFormation, setShowSaveFormation] = useState(false);
  const [saveFormationName, setSaveFormationName] = useState("");
  const [savingFormation, setSavingFormation] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiExplanation, setAiExplanation] = useState("");
  const [aiExplanationOpen, setAiExplanationOpen] = useState(true);
  const [aiUndoSnapshot, setAiUndoSnapshot] = useState<Arrow[] | null>(null);
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [arrowDrag, setArrowDrag] = useState<{ id: string; lastX: number; lastY: number } | null>(null);
  const [lineMode, setLineMode] = useState<LineMode>("curve");
  const [lineType, setLineType] = useState<LineType>("move");

  const [playing, setPlaying] = useState(false);
  const [animPos, setAnimPos] = useState<Record<string, { x: number; y: number }> | null>(null);
  const [loopPlay, setLoopPlay] = useState(false);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const dragOriginRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const loopRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const pitchRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // 재생이 끝난 뒤 보드를 편집하면 재생용 임시 위치를 걷어내서 실제 위치가 바로 보이게 함
  useEffect(() => {
    if (!playing) setAnimPos(null);
  }, [tokens, arrows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch(`/api/tactics/${id}`)
      .then(res => { if (!res.ok) { setNotFound(true); return null; } return res.json(); })
      .then(data => {
        if (!data) return;
        setTitle(data.title);
        setPublished(data.published);
        setEditable(data.editable);
        setFormationName(data.formation_name);
        setTokens(data.tokens ?? []);
        setArrows(data.arrows ?? []);
        setLoading(false);
      });
    fetch("/api/formations")
      .then(res => (res.ok ? res.json() : []))
      .then(data => setCustomFormations(Array.isArray(data) ? data : []));
  }, [id]);

  function pointFromEvent(e: { clientX: number; clientY: number }) {
    const rect = pitchRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }

  function handlePitchPointerDown(e: React.PointerEvent) {
    if (!editable || playing || draggingId || arrowDrag) return;
    setSelectedTokenId(null);
    const { x, y } = pointFromEvent(e);
    setDraft({ x1: x, y1: y, x2: x, y2: y });
  }

  function handlePitchPointerMove(e: React.PointerEvent) {
    if (!editable) return;
    if (draggingId) {
      const { x, y } = pointFromEvent(e);
      setTokens(prev => prev.map(t => (t.id === draggingId ? { ...t, x, y } : t)));
      return;
    }
    if (arrowDrag) {
      const { x, y } = pointFromEvent(e);
      const dx = x - arrowDrag.lastX;
      const dy = y - arrowDrag.lastY;
      setArrows(prev => prev.map(a => (a.id === arrowDrag.id ? { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy } : a)));
      setArrowDrag(d => (d ? { ...d, lastX: x, lastY: y } : d));
      return;
    }
    if (!draft) return;
    const { x, y } = pointFromEvent(e);
    setDraft(d => (d ? { ...d, x2: x, y2: y } : d));
  }

  function handlePitchPointerUp() {
    if (!editable) return;
    if (draggingId) {
      const origin = dragOriginRef.current;
      const dragged = tokens.find(t => t.id === draggingId);
      const moved = origin && dragged ? Math.hypot(dragged.x - origin.x, (dragged.y - origin.y) * 1.4) : 0;
      if (dragged && moved < 1.5 && dragged.team === "us") {
        setSelectedTokenId(dragged.id);
      } else if (dragged && moved >= 1.5) {
        applyZoneLabel(dragged.id);
      }
      dragOriginRef.current = null;
      setDraggingId(null);
      if (moved >= 1.5) setDirty(true);
      return;
    }
    if (arrowDrag) {
      setArrowDrag(null);
      setDirty(true);
      return;
    }
    if (!draft) return;
    const dist = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1);
    if (dist > 3) {
      setArrows(prev => [...prev, { id: uid(), ...draft, mode: lineMode, type: lineType }]);
      setDirty(true);
    }
    setDraft(null);
  }

  function startArrowDrag(arrowId: string, e: React.PointerEvent) {
    const { x, y } = pointFromEvent(e);
    setArrowDrag({ id: arrowId, lastX: x, lastY: y });
  }

  function removeArrow(arrowId: string) {
    setArrows(prev => prev.filter(a => a.id !== arrowId));
    setDirty(true);
  }

  function controlPoint(a: { x1: number; y1: number; x2: number; y2: number }) {
    const mx = (a.x1 + a.x2) / 2;
    const my = (a.y1 + a.y2) / 2;
    const dx = a.x2 - a.x1;
    const dy = a.y2 - a.y1;
    const len = Math.hypot(dx, dy) || 1;
    const offset = len * 0.2;
    return { cx: mx + (-dy / len) * offset, cy: my + (dx / len) * offset };
  }

  function arrowPath(a: { x1: number; y1: number; x2: number; y2: number; mode: LineMode }) {
    if (a.mode === "straight") return `M ${a.x1} ${a.y1} L ${a.x2} ${a.y2}`;
    const { cx, cy } = controlPoint(a);
    return `M ${a.x1} ${a.y1} Q ${cx} ${cy} ${a.x2} ${a.y2}`;
  }

  // 화살표 번호 라벨을 놓을 위치 — 직선은 중점, 곡선은 베지어 곡선의 실제 중점(t=0.5)
  function arrowLabelPos(a: { x1: number; y1: number; x2: number; y2: number; mode: LineMode }) {
    if (a.mode === "straight") return { x: (a.x1 + a.x2) / 2, y: (a.y1 + a.y2) / 2 };
    const { cx, cy } = controlPoint(a);
    return { x: 0.25 * a.x1 + 0.5 * cx + 0.25 * a.x2, y: 0.25 * a.y1 + 0.5 * cy + 0.25 * a.y2 };
  }

  // 같은 번호의 움직임·패스를 한 단계로 묶음. 움직임은 시작점에서 가장 가까운 선수(이전 단계 이동 결과 기준)가 따라가고,
  // 패스는 공 토큰이 있을 때만 재생됨
  // 단계는 공이 가는 패스 순서대로 만들고, 도착 지점이 그 패스 끝점 근처인 움직임을 같은 단계에 묶어서
  // 공과 선수가 같은 시간에 같은 지점으로 도착하게 함. 어떤 패스와도 안 맞는 움직임은 번호 순서대로
  // 같은 번호의 단계에 붙이고(없으면 새 단계), 움직임은 시작점에서 가장 가까운 선수(이전 단계 이동 결과 기준)가 따라감
  function buildPlaybackSteps(): PlaybackStep[] {
    const moves = arrows.filter(a => a.type === "move");
    const ballExists = tokens.some(t => t.team === "ball");
    const passes = ballExists ? arrows.filter(a => a.type === "pass") : [];
    const cur: Record<string, { x: number; y: number }> = {};
    tokens.forEach(t => { cur[t.id] = { x: t.x, y: t.y }; });

    const steps: PlaybackStep[] = passes.map(p => ({ moves: [], pass: { arrow: p }, durationMs: EMPTY_STEP_MS }));
    const stepMoves: Arrow[][] = steps.map(() => []);
    const unpaired: Arrow[] = [];
    for (const m of moves) {
      let bestJ = -1;
      let bestD = Infinity;
      passes.forEach((p, j) => {
        const d = Math.hypot(p.x2 - m.x2, (p.y2 - m.y2) * 1.4);
        if (d <= MOVER_MAX_DIST && d < bestD) { bestD = d; bestJ = j; }
      });
      if (bestJ >= 0) stepMoves[bestJ].push(m);
      else unpaired.push(m);
    }
    unpaired.forEach((m, u) => {
      while (steps.length <= u) { steps.push({ moves: [], durationMs: EMPTY_STEP_MS }); stepMoves.push([]); }
      stepMoves[u].push(m);
    });

    steps.forEach((step, i) => {
      for (const m of stepMoves[i]) {
        let best: { id: string; d: number } | null = null;
        for (const t of tokens) {
          if (t.team === "ball") continue;
          const d = Math.hypot(cur[t.id].x - m.x1, (cur[t.id].y - m.y1) * 1.4);
          if (d <= MOVER_MAX_DIST && (!best || d < best.d)) best = { id: t.id, d };
        }
        if (best) {
          step.moves.push({ tokenId: best.id, arrow: m });
          cur[best.id] = { x: m.x2, y: m.y2 };
        }
      }
      // 공이 그 단계에서 움직이는 선수 중 가장 가까운 도착점에 정확히 도착하게 맞춤
      if (step.pass) {
        const pa = step.pass.arrow;
        let target: Arrow | null = null;
        let targetD = Infinity;
        for (const mv of step.moves) {
          const d = Math.hypot(pa.x2 - mv.arrow.x2, (pa.y2 - mv.arrow.y2) * 1.4);
          if (d <= MOVER_MAX_DIST && d < targetD) { targetD = d; target = mv.arrow; }
        }
        if (target) step.pass = { arrow: { ...pa, x2: target.x2, y2: target.y2 } };
      }
      const needMs = Math.max(
        step.pass ? (arrowLength(step.pass.arrow) / BALL_SPEED) * 1000 : 0,
        ...step.moves.map(mv => (arrowLength(mv.arrow) / PLAYER_SPEED) * 1000),
      );
      if (needMs > 0) step.durationMs = Math.min(MAX_STEP_MS, Math.max(MIN_STEP_MS, needMs));
    });
    return steps;
  }

  function stopPlayback() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
  }

  function resetPlayback() {
    stopPlayback();
    setAnimPos(null);
  }

  function startPlayback() {
    if (playing) return;
    const steps = buildPlaybackSteps();
    if (steps.length === 0) return;
    const ballId = tokens.find(t => t.team === "ball")?.id;
    const startPos: Record<string, { x: number; y: number }> = {};
    tokens.forEach(t => { startPos[t.id] = { x: t.x, y: t.y }; });
    const starts: number[] = [];
    let total = 0;
    steps.forEach(st => { starts.push(total); total += st.durationMs; });

    setPlaying(true);
    let t0 = performance.now();
    let pauseUntil = 0;
    const frame = (now: number) => {
      if (pauseUntil) {
        if (now < pauseUntil) { rafRef.current = requestAnimationFrame(frame); return; }
        if (!loopRef.current) { setPlaying(false); rafRef.current = null; return; }
        pauseUntil = 0;
        t0 = now;
      }
      const elapsed = now - t0;
      const done = elapsed >= total;
      const pos = { ...startPos };
      steps.forEach((s, i) => {
        const local = elapsed - starts[i];
        const prog = done || local >= s.durationMs ? 1 : local <= 0 ? 0 : ease(local / s.durationMs);
        if (prog === 0) return;
        s.moves.forEach(mv => { pos[mv.tokenId] = pointOnArrow(mv.arrow, prog); });
        if (s.pass && ballId) pos[ballId] = pointOnArrow(s.pass.arrow, prog);
      });
      setAnimPos(pos);
      if (done) {
        if (loopRef.current) { pauseUntil = now + 700; rafRef.current = requestAnimationFrame(frame); return; }
        setPlaying(false);
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }

  // 놓은 구역에 맞춰 포지션 이름을 자동으로 바꿈 — 우리팀 11명일 때만, GK/직접 고른 포지션은 건드리지 않음
  function applyZoneLabel(tokenId: string) {
    setTokens(prev => {
      if (prev.filter(t => t.team === "us").length !== 11) return prev;
      return prev.map(t => {
        if (t.id !== tokenId || t.team !== "us" || t.posManual || isGoalkeeper(t)) return t;
        const next = zonePosition(t.x, t.y);
        if (next === t.pos) return t;
        const labelFollowsPos = !t.label || t.label === t.pos;
        return { ...t, pos: next, label: labelFollowsPos ? next : t.label };
      });
    });
  }

  function setTokenPosition(tokenId: string, pos: string) {
    setTokens(prev => prev.map(t => {
      if (t.id !== tokenId) return t;
      const labelFollowsPos = !t.label || t.label === t.pos;
      return { ...t, pos, posManual: true, label: labelFollowsPos ? pos : t.label };
    }));
    setDirty(true);
  }

  function resetTokenPositionToAuto(tokenId: string) {
    setTokens(prev => prev.map(t => {
      if (t.id !== tokenId) return t;
      const next = zonePosition(t.x, t.y);
      const labelFollowsPos = !t.label || t.label === t.pos;
      return { ...t, pos: next, posManual: false, label: labelFollowsPos ? next : t.label };
    }));
    setDirty(true);
  }

  function changeFormation(name: string) {
    const slots = getFormationSlots(name, customFormations);
    if (!slots) return;
    setFormationName(name);
    setTokens(prev => [
      ...slots.map(s => ({ id: s.id, x: s.x, y: s.y, team: "us" as const, label: s.label, pos: s.label })),
      ...prev.filter(t => t.team !== "us"),
    ]);
    setDirty(true);
  }

  const hasBall = tokens.some(t => t.team === "ball");
  const detectedFormation = detectFormationName(tokens);
  const selectedToken = tokens.find(t => t.id === selectedTokenId && t.team === "us") ?? null;

  function addBall() {
    if (hasBall) return;
    setTokens(prev => [...prev, { id: uid(), x: 50, y: 50, team: "ball" }]);
    setDirty(true);
  }

  // 우리팀 인원수 기준 — 직접 배치한 이름(예: 4-3-1-2)처럼 목록에 없는 이름으로 저장된 보드에서도 똑같이 동작
  const usCount = tokens.filter(t => t.team === "us").length;
  const maxOpponents = usCount > 0 ? usCount : Infinity;

  // 드래그로 배치를 바꿨으면 고른 포메이션 이름과 달라짐 — 선택칸엔 바뀐 이름을 보여주고 저장도 바뀐 이름으로
  const selectedFormationLabel = FORMATIONS[formationName] ? formationName : customFormations.find(f => f.id === formationName)?.name;
  const layoutChanged = !!detectedFormation && detectedFormation !== selectedFormationLabel;
  const opponentCount = tokens.filter(t => t.team === "opp").length;

  function addOpponent() {
    if (opponentCount >= maxOpponents) return;
    setTokens(prev => [...prev, { id: uid(), x: 50, y: 50, team: "opp" }]);
    setDirty(true);
  }

  function setOpponentFormation(name: string) {
    const slots = getFormationSlots(name, customFormations);
    if (!slots) return;
    setTokens(prev => [
      ...prev.filter(t => t.team !== "opp"),
      ...slots.map(s => ({ id: uid(), x: s.x, y: 100 - s.y, team: "opp" as const, label: s.label, pos: s.label })),
    ]);
    setDirty(true);
    setOppFormationPick("");
  }

  async function askAI() {
    if (!aiQuestion.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/tactics/${id}/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: aiQuestion.trim(), tokens, arrows }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error ?? "AI 추천에 실패했어요.");
        return;
      }
      const newArrows: Arrow[] = (data.arrows ?? []).map((a: Omit<Arrow, "id">) => ({ ...a, id: uid() }));
      setAiUndoSnapshot(arrows);
      setArrows(prev => [...prev, ...newArrows]);
      setAiExplanation(data.explanation ?? "");
      setAiExplanationOpen(true);
      setDirty(true);
    } catch {
      setAiError("AI 추천에 실패했어요. 다시 시도해주세요.");
    } finally {
      setAiLoading(false);
    }
  }

  function undoAiSuggestion() {
    if (aiUndoSnapshot === null) return;
    setArrows(aiUndoSnapshot);
    setAiUndoSnapshot(null);
    setAiExplanation("");
    setDirty(true);
  }

  async function openImport() {
    setShowImport(true);
    if (importList) return;
    const res = await fetch("/api/assignments?all=true");
    setImportList(res.ok ? await res.json() : []);
  }

  async function importAssignment(assignmentId: string) {
    setImporting(true);
    const res = await fetch(`/api/assignments/${assignmentId}`);
    if (res.ok) {
      const data: AssignmentDetail = await res.json();
      setFormationName(FORMATIONS[data.formation_name] ? data.formation_name : formationName);
      setTokens(prev => [
        ...(data.formation_slots ?? []).map(s => ({
          id: s.id,
          x: s.x,
          y: s.y,
          team: "us" as const,
          label: data.result?.[s.id]?.name ?? s.label,
          pos: s.label,
        })),
        ...prev.filter(t => t.team !== "us"),
      ]);
      setDirty(true);
    }
    setImporting(false);
    setShowImport(false);
  }

  async function saveCurrentAsFormation() {
    if (!saveFormationName.trim() || savingFormation) return;
    const usTokens = tokens.filter(t => t.team === "us");
    if (usTokens.length === 0) return;
    setSavingFormation(true);
    const slots = usTokens.map(t => ({ id: t.id, x: t.x, y: t.y, label: t.pos ?? t.label ?? "" }));
    const res = await fetch("/api/formations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveFormationName.trim(), slots }),
    });
    if (res.ok) {
      const created = await res.json();
      setCustomFormations(prev => [...prev, created]);
      setShowSaveFormation(false);
      setSaveFormationName("");
    }
    setSavingFormation(false);
  }

  function removeToken(tokenId: string) {
    setTokens(prev => prev.filter(t => t.id !== tokenId));
    setDirty(true);
  }

  function undoLastArrow() {
    setArrows(prev => prev.slice(0, -1));
    setDirty(true);
  }

  function clearArrows() {
    setArrows([]);
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/tactics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, formation_name: detectedFormation ?? formationName, tokens, arrows }),
    });
    setSaving(false);
    if (res.ok) setDirty(false);
  }

  async function togglePublished() {
    const next = !published;
    const res = await fetch(`/api/tactics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    if (res.ok) setPublished(next);
  }

  async function deleteBoard() {
    if (!confirm("이 전술판을 삭제할까요?")) return;
    const res = await fetch(`/api/tactics/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/tactics");
  }

  if (loading) return (
    <AppLayout title="전술판">
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    </AppLayout>
  );

  if (notFound) return (
    <AppLayout title="전술판">
      <div className="text-center py-20">
        <p className="text-gray-500 text-sm">전술판을 찾을 수 없어요</p>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout title={title}>
      <div className="max-w-lg mx-auto px-3 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push(editable ? "/tactics" : "/board")}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors bg-gray-900 border border-white/5 px-3 py-1.5 rounded-xl"
          >
            <ChevronLeft size={14} /> {editable ? "목록으로" : "게시판으로"}
          </button>
          {editable && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePublished}
                className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl border transition-colors ${
                  published ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-gray-900 border-white/10 text-gray-400 hover:text-gray-200"
                }`}
              >
                <Check size={13} /> {published ? "게시됨" : "게시판에 올리기"}
              </button>
              <button
                onClick={deleteBoard}
                className="flex items-center justify-center w-8 h-8 rounded-xl bg-gray-900 border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30 transition-colors"
              >
                <Trash size={14} />
              </button>
            </div>
          )}
        </div>

        {editable && (
          <input
            value={title}
            onChange={e => { setTitle(e.target.value); setDirty(true); }}
            className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        )}

        {editable && (
          <div>
            <p className="text-xs text-gray-500 mb-1.5">포메이션</p>
            <ScrimmageSelect
              value={layoutChanged ? "" : formationName}
              onChange={changeFormation}
              placeholder={layoutChanged ? `${detectedFormation} (직접 배치)` : "포메이션 선택"}
              options={SOCCER_FORMATION_NAMES.map(name => ({ value: name, label: name }))}
              groups={customFormations.length > 0 ? [{ label: "내 커스텀 포메이션", options: customFormations.map(f => ({ value: f.id, label: f.name })) }] : []}
            />
            {detectedFormation && (
              <p className="text-[11px] text-gray-500 mt-1.5">
                현재 배치: <span className="font-bold text-emerald-400">{detectedFormation}</span>
                <span className="text-gray-600"> · 선수를 드래그하면 놓은 자리에 맞게 포지션이 바뀌어요</span>
              </p>
            )}
          </div>
        )}

        {editable && (
          <div className="flex gap-2">
            <button
              onClick={openImport}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 text-gray-200 px-3 py-2.5 rounded-xl transition-colors"
            >
              <Download size={14} /> 포지션 배정에서 불러오기
            </button>
            <button
              onClick={() => { if (!saveFormationName.trim() && detectedFormation) setSaveFormationName(detectedFormation); setShowSaveFormation(true); }}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 text-gray-200 px-3 py-2.5 rounded-xl transition-colors"
            >
              <LayoutGrid size={14} /> 커스텀 포메이션으로 저장
            </button>
          </div>
        )}

        {editable && (
          <>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 shrink-0">선 모양</p>
              {(["curve", "straight"] as LineMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setLineMode(m)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                    lineMode === m ? "bg-white/15 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {m === "curve" ? "곡선" : "직선"}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500 shrink-0">선 종류</p>
              {(["move", "pass"] as LineType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setLineType(t)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                    lineType === t ? "bg-white/15 text-white" : "bg-gray-900 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: LINE_COLORS[t] }} />
                  {LINE_LABELS[t]}
                </button>
              ))}
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={addOpponent}
                disabled={opponentCount >= maxOpponents}
                className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 disabled:opacity-40 text-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                <Plus size={14} /> 상대 추가
              </button>
              <div className="w-40">
                <ScrimmageSelect
                  value={oppFormationPick}
                  onChange={setOpponentFormation}
                  placeholder="상대 포메이션 추가"
                  options={getMatchingFormationNames(usCount, customFormations)
                    .map(name => ({ value: name, label: customFormations.find(f => f.id === name)?.name ?? name }))}
                />
              </div>
              <button
                onClick={addBall}
                disabled={hasBall}
                className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 disabled:opacity-40 text-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                <BallIcon size={14} /> 공 추가
              </button>
              <button
                onClick={undoLastArrow}
                disabled={arrows.length === 0}
                className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 disabled:opacity-40 text-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                <Undo2 size={14} /> 실행취소
              </button>
              <button
                onClick={clearArrows}
                disabled={arrows.length === 0}
                className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 disabled:opacity-40 text-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                <Trash2 size={14} /> 화살표 지우기
              </button>
            </div>

            <p className="text-[11px] text-gray-600">피치 위를 드래그하면 화살표가 그려져요. 선수·상대 말 둘 다 드래그해서 옮길 수 있어요.</p>

            <div className="space-y-2 bg-gray-900/60 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-gray-400 font-bold flex items-center gap-1.5"><Wand2 size={13} /> AI에게 전술 물어보기</p>
              <div className="flex gap-2">
                <input
                  value={aiQuestion}
                  onChange={e => setAiQuestion(e.target.value)}
                  placeholder="예: 상대가 높은 라인을 쓸 때 어떻게 공략하지?"
                  className="flex-1 bg-gray-800 border border-white/10 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={askAI}
                  disabled={!aiQuestion.trim() || aiLoading}
                  className="flex items-center gap-1 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black px-3 py-2 rounded-lg transition-colors shrink-0"
                >
                  {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                  추천
                </button>
              </div>
              {aiError && <p className="text-xs text-red-400">{aiError}</p>}
              {aiExplanation && (
                <div className="bg-gray-800/80 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setAiExplanationOpen(v => !v)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-bold text-gray-300"
                  >
                    AI는 왜 이렇게 추천했을까?
                    <ChevronDown size={14} className={`transition-transform ${aiExplanationOpen ? "rotate-180" : ""}`} />
                  </button>
                  {aiExplanationOpen && (
                    <div className="px-2.5 pb-2.5 space-y-1.5">
                      <p className="text-xs text-gray-300">{aiExplanation}</p>
                      <button onClick={undoAiSuggestion} className="text-[11px] font-bold text-red-400 hover:text-red-300">
                        AI 제안 취소
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {editable && !playing && selectedToken && (
          <div className="flex items-center gap-2 bg-gray-900/60 border border-yellow-400/30 rounded-xl p-3">
            <div className="shrink-0 min-w-0">
              <p className="text-[11px] text-gray-500">선택한 선수</p>
              <p className="text-sm font-bold text-white truncate max-w-[6rem]">{selectedToken.label ?? selectedToken.pos}</p>
            </div>
            <div className="flex-1 min-w-0">
              <PositionSelect value={selectedToken.pos ?? ""} onChange={v => setTokenPosition(selectedToken.id, v)} />
            </div>
            {selectedToken.posManual && selectedToken.pos !== "GK" && (
              <button
                onClick={() => resetTokenPositionToAuto(selectedToken.id)}
                className="shrink-0 text-[11px] font-bold text-emerald-400 hover:text-emerald-300"
              >
                자동으로
              </button>
            )}
          </div>
        )}

        {arrows.length > 0 && (
          <div className="flex items-center flex-wrap gap-2">
            {playing ? (
              <button
                onClick={resetPlayback}
                className="flex items-center gap-1.5 text-xs font-bold bg-red-500/15 border border-red-500/30 text-red-300 px-3 py-2 rounded-xl transition-colors"
              >
                <Square size={13} /> 정지
              </button>
            ) : (
              <button
                onClick={startPlayback}
                className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-2 rounded-xl transition-colors"
              >
                <Play size={13} /> {animPos ? "다시 재생" : "재생"}
              </button>
            )}
            {animPos && !playing && (
              <button
                onClick={resetPlayback}
                className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 text-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                <RotateCcw size={13} /> 처음으로
              </button>
            )}
            <button
              onClick={() => { const next = !loopPlay; setLoopPlay(next); loopRef.current = next; }}
              className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                loopPlay ? "bg-white/15 border-white/20 text-white" : "bg-gray-900 border-white/10 text-gray-500 hover:text-gray-300"
              }`}
            >
              <Repeat size={13} /> 반복
            </button>
            <p className="text-[11px] text-gray-600">도착 지점이 같은 움직임·패스가 같이 도착해요{hasBall ? "" : " (패스는 공이 있어야 재생돼요)"}</p>
          </div>
        )}

        <div
          ref={pitchRef}
          onPointerDown={handlePitchPointerDown}
          onPointerMove={handlePitchPointerMove}
          onPointerUp={handlePitchPointerUp}
          onPointerLeave={handlePitchPointerUp}
          className={`relative w-full rounded-lg overflow-hidden select-none ${editable ? "touch-none" : ""}`}
          style={{ paddingBottom: "140%", background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)" }}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute border border-white/20 inset-[2%] rounded-sm" />
            <div className="absolute w-full border-t border-white/20" style={{ top: "50%" }} />
            <div className="absolute border border-white/20 rounded-full" style={{ width: "22%", height: "13%", top: "43.5%", left: "39%" }} />
          </div>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              {(["move", "pass"] as LineType[]).map(t => (
                <marker key={t} id={`arrowhead-${t}`} markerWidth="3" markerHeight="3" refX="2.4" refY="1.5" orient="auto">
                  <polygon points="0 0, 3 1.5, 0 3" fill={LINE_COLORS[t]} />
                </marker>
              ))}
            </defs>
            {arrows.map(a => (
              <path
                key={a.id}
                d={arrowPath(a)}
                stroke={LINE_COLORS[a.type]}
                strokeWidth={1.4}
                fill="none"
                vectorEffect="non-scaling-stroke"
                markerEnd={`url(#arrowhead-${a.type})`}
              />
            ))}
            {draft && (
              <path
                d={arrowPath({ ...draft, mode: lineMode })}
                stroke={LINE_COLORS[lineType]}
                strokeWidth={1.4}
                strokeDasharray="3 2"
                fill="none"
                vectorEffect="non-scaling-stroke"
                markerEnd={`url(#arrowhead-${lineType})`}
              />
            )}
          </svg>

          {/* 화살표 순서 번호 — 움직임/패스 각각 따로 1번부터. 드래그로 전체 이동, X로 삭제 */}
          {(() => {
            const seqByType: Record<LineType, number> = { move: 0, pass: 0 };
            return arrows.map(a => {
              seqByType[a.type] += 1;
              const pos = arrowLabelPos(a);
              return (
                <div
                  key={a.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                >
                  <div
                    onPointerDown={e => { if (editable && !playing) { e.stopPropagation(); startArrowDrag(a.id, e); } }}
                    className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-white shadow ${editable ? "cursor-grab active:cursor-grabbing" : "pointer-events-none"}`}
                    style={{ background: LINE_COLORS[a.type] }}
                  >
                    {seqByType[a.type]}
                  </div>
                  {editable && (
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={() => removeArrow(a.id)}
                      className="absolute -top-2 -right-2 w-3.5 h-3.5 rounded-full bg-gray-900 border border-white/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
                    >
                      <X size={8} />
                    </button>
                  )}
                </div>
              );
            });
          })()}

          {tokens.map(t => {
            const pc = t.team === "us" ? positionColor(t.pos) : null;
            return (
            <div
              key={t.id}
              onPointerDown={e => { if (editable && !playing) { e.stopPropagation(); dragOriginRef.current = { id: t.id, x: t.x, y: t.y }; setDraggingId(t.id); } }}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full shadow-lg font-black leading-none text-center ${
                t.team === "ball" ? "w-6 h-6" : "w-8 h-8 border-2 text-[10px] px-0.5"
              } ${t.team === "opp" ? "bg-white border-gray-300 text-gray-900" : ""
              } ${editable && !playing ? "cursor-grab active:cursor-grabbing" : ""} ${selectedTokenId === t.id ? "ring-2 ring-yellow-300" : ""}`}
              style={{
                left: `${(animPos?.[t.id] ?? t).x}%`,
                top: `${(animPos?.[t.id] ?? t).y}%`,
                ...(t.team === "ball" ? { zIndex: 5 } : {}),
                ...(pc ? { background: pc.bg, borderColor: pc.border, color: pc.color } : {}),
              }}
            >
              {t.team === "ball" ? <BallIcon size={24} /> : t.label}
              {editable && !playing && (t.team === "opp" || t.team === "ball") && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => removeToken(t.id)}
                  className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-gray-900 border border-white/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>
            );
          })}
        </div>

        {editable && (
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold py-3 rounded-xl transition-colors"
          >
            <Save size={15} /> {saving ? "저장 중..." : dirty ? "저장" : "저장됨"}
          </button>
        )}
      </div>

      {showImport && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowImport(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-1">포지션 배정에서 불러오기</h2>
            <p className="text-xs text-gray-500 mb-4">고르면 우리 팀 위치가 실제 배정된 선수 이름으로 바뀌어요.</p>
            <div className="overflow-y-auto themed-scroll -mx-1 px-1">
              {importList === null ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : importList.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">불러올 배정이 없어요</p>
              ) : (
                <div className="space-y-1.5">
                  {importList.map(item => (
                    <button
                      key={item.id}
                      onClick={() => importAssignment(item.id)}
                      disabled={importing}
                      className="w-full text-left bg-gray-800 hover:bg-gray-800/70 disabled:opacity-50 border border-white/5 rounded-xl px-3 py-2.5 transition-colors"
                    >
                      <p className="text-sm font-bold text-white">
                        {item.matches?.title ?? "독립 세션"} · {item.session_name}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {item.formation_name}{item.matches?.match_date ? ` · ${item.matches.match_date}` : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSaveFormation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowSaveFormation(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-1">커스텀 포메이션으로 저장</h2>
            <p className="text-xs text-gray-500 mb-4">지금 우리팀 배치 그대로 새 커스텀 포메이션으로 저장돼요. (선수 이름이 아니라 포지션 자리만 저장돼요)</p>
            <input
              value={saveFormationName}
              onChange={e => setSaveFormationName(e.target.value)}
              placeholder="포메이션 이름 (예: 수비 집중형)"
              className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-3"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowSaveFormation(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-gray-400 py-2.5 rounded-xl font-semibold text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveCurrentAsFormation}
                disabled={!saveFormationName.trim() || savingFormation}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black py-2.5 rounded-xl font-bold text-sm transition-colors"
              >
                {savingFormation ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
