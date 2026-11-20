"use client";

import { useRef, useState } from "react";
import {
  arrowLabelPos, arrowPath, LINE_COLORS, MAX_ARROWS, positionColor,
  type Arrow, type LineMode, type LineType, type Token,
} from "@/lib/tacticsBoard";
import type { Positions } from "@/lib/tacticsPlayback";

// 이모지는 기기마다 모양이 달라서 체크무늬 축구공을 SVG로 직접 그린다 (전술판 페이지와 같은 모양)
const pentagon = (cx: number, cy: number, r: number, rotDeg: number) =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((rotDeg + k * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
const BALL_CENTER = pentagon(50, 50, 17, -90);
const BALL_SPOKES = Array.from({ length: 5 }, (_, k) => {
  const a = ((-90 + k * 72) * Math.PI) / 180;
  return { x1: 50 + 17 * Math.cos(a), y1: 50 + 17 * Math.sin(a), x2: 50 + 48 * Math.cos(a), y2: 50 + 48 * Math.sin(a) };
});

function BallIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="block">
      <circle cx="50" cy="50" r="48" fill="#fff" />
      <g fill="#111827" stroke="#111827" strokeWidth="2.5" strokeLinejoin="round">
        {BALL_SPOKES.map((l, i) => <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} fill="none" />)}
        <polygon points={BALL_CENTER} />
      </g>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#111827" strokeWidth="3" />
    </svg>
  );
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * 전술판 그림. editable이면 설명하는 사람이 고친다, 아니면 보기만 한다(관람하는 사람). 그림 모양은 전술판 페이지와 같다.
 * 고치는 방법은 tool로 정한다:
 *  - "draw": 선수는 그 자리에 고정되고, 어디서 끌든(선수 위에서 시작해도) 화살표가 그려진다.
 *  - "move": 선수를 끌어 옮긴다. 선은 그려지지 않는다.
 * 상태는 부모가 들고 있다: 바뀔 때마다 onChange로 새 선수·화살표를 알려 준다.
 * positions는 재생 중인 위치(말 id → 좌표)다. 있으면 판의 위치 대신 이 위치에 그린다.
 * onRemoveToken을 주면 상대·공에 지우기(✕) 버튼이 생긴다(고칠 수 있을 때만).
 */
export default function TacticsPitch({
  tokens,
  arrows,
  editable = false,
  tool = "draw",
  lineType = "move",
  lineMode = "curve",
  positions = null,
  onRemoveToken,
  onChange,
}: {
  tokens: Token[];
  arrows: Arrow[];
  editable?: boolean;
  tool?: "draw" | "move";
  lineType?: LineType;
  lineMode?: LineMode;
  positions?: Positions | null;
  onRemoveToken?: (id: string) => void;
  onChange?: (tokens: Token[], arrows: Arrow[]) => void;
}) {
  const pitchRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function point(e: { clientX: number; clientY: number }) {
    const rect = pitchRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!editable || tool !== "draw" || draggingId) return;
    const { x, y } = point(e);
    setDraft({ x1: x, y1: y, x2: x, y2: y });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!editable) return;
    if (draggingId) {
      const { x, y } = point(e);
      onChange?.(tokens.map(t => (t.id === draggingId ? { ...t, x, y } : t)), arrows);
      return;
    }
    if (!draft) return;
    const { x, y } = point(e);
    setDraft(d => (d ? { ...d, x2: x, y2: y } : d));
  }
  function onPointerUp() {
    if (!editable) return;
    if (draggingId) {
      setDraggingId(null);
      return;
    }
    if (!draft) return;
    // 너무 짧게 끌린 건 그냥 탭이므로 화살표로 만들지 않는다. 화살표 수도 제한한다.
    if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 3 && arrows.length < MAX_ARROWS) {
      onChange?.(tokens, [...arrows, { id: newId(), ...draft, mode: lineMode, type: lineType }]);
    }
    setDraft(null);
  }

  const seqByType: Record<LineType, number> = { move: 0, pass: 0 };

  return (
    <div
      ref={pitchRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      className={`relative w-full h-full rounded-lg overflow-hidden select-none ${editable ? "touch-none" : ""}`}
      style={{ background: "linear-gradient(180deg, #166534 0%, #14532d 40%, #15803d 60%, #166534 100%)" }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute border border-white/20 inset-[2%] rounded-sm" />
        <div className="absolute w-full border-t border-white/20" style={{ top: "50%" }} />
        <div className="absolute border border-white/20 rounded-full" style={{ width: "22%", height: "13%", top: "43.5%", left: "39%" }} />
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
        <defs>
          {(["move", "pass"] as LineType[]).map(t => (
            <marker key={t} id={`lounge-arrowhead-${t}`} markerWidth="3" markerHeight="3" refX="2.4" refY="1.5" orient="auto">
              <polygon points="0 0, 3 1.5, 0 3" fill={LINE_COLORS[t]} />
            </marker>
          ))}
        </defs>
        {arrows.map(a => (
          <path key={a.id} d={arrowPath(a)} stroke={LINE_COLORS[a.type]} strokeWidth={1.4} fill="none" vectorEffect="non-scaling-stroke" markerEnd={`url(#lounge-arrowhead-${a.type})`} />
        ))}
        {draft && (
          <path
            d={arrowPath({ ...draft, mode: lineMode })}
            stroke={LINE_COLORS[lineType]}
            strokeWidth={1.4}
            strokeDasharray="3 2"
            fill="none"
            vectorEffect="non-scaling-stroke"
            markerEnd={`url(#lounge-arrowhead-${lineType})`}
          />
        )}
      </svg>

      {/* 화살표 순서 번호 — 움직임/패스 각각 따로 1번부터 */}
      {arrows.map(a => {
        seqByType[a.type] += 1;
        const pos = arrowLabelPos(a);
        return (
          <div
            key={a.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-white shadow"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, background: LINE_COLORS[a.type] }}
          >
            {seqByType[a.type]}
          </div>
        );
      })}

      {tokens.map(t => {
        const pc = t.team === "us" ? positionColor(t.pos) : null;
        return (
          <div
            key={t.id}
            onPointerDown={e => {
              // 선 긋기 중에는 선수를 잡지 않는다 — 이벤트가 판으로 올라가서 이 자리에서 시작하는 선이 그려진다
              if (!editable || tool !== "move") return;
              e.stopPropagation();
              setDraggingId(t.id);
            }}
            className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full shadow-lg font-black leading-none text-center ${
              t.team === "ball" ? "w-6 h-6" : "w-8 h-8 border-2 text-[10px] px-0.5"
            } ${t.team === "opp" ? "bg-white border-gray-300 text-gray-900" : ""} ${editable && tool === "move" ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{
              left: `${(positions?.[t.id] ?? t).x}%`,
              top: `${(positions?.[t.id] ?? t).y}%`,
              // 재생 중에는 프레임 사이를 부드럽게 이어 준다(끌어서 옮길 때는 손가락을 바로 따라가야 하므로 적용하지 않는다)
              ...(positions ? { transition: "left 70ms linear, top 70ms linear" } : {}),
              ...(t.team === "ball" ? { zIndex: 5 } : {}),
              ...(pc ? { background: pc.bg, borderColor: pc.border, color: pc.color } : {}),
            }}
          >
            {t.team === "ball" ? <BallIcon size={24} /> : t.label}
            {editable && onRemoveToken && (t.team === "opp" || t.team === "ball") && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={() => onRemoveToken(t.id)}
                aria-label="지우기"
                className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full bg-gray-900 border border-white/25 text-gray-300 flex items-center justify-center text-[10px] leading-none font-bold"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
