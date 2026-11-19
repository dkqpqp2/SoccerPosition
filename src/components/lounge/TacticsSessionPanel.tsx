"use client";

import { useEffect, useRef, useState } from "react";
import { FORMATIONS } from "@/lib/formations";
import { LINE_COLORS, LINE_LABELS, sanitizeBoard, type BoardSnapshot, type LineMode, type LineType } from "@/lib/tacticsBoard";
import TacticsPitch from "./TacticsPitch";
import type { ChatMessage, Presenter } from "./useLoungeRoom";

export type TacticsMode = "present" | "watch";

const SOCCER_FORMATIONS = Object.keys(FORMATIONS).filter(k => FORMATIONS[k].type === "soccer");

function boardFromFormation(name: string): BoardSnapshot {
  const f = FORMATIONS[name] ?? FORMATIONS[SOCCER_FORMATIONS[0]];
  return { title: name, tokens: f.slots.map(s => ({ id: s.id, x: s.x, y: s.y, team: "us" as const, label: s.label, pos: s.label })), arrows: [] };
}

function PanelHeader({ presenting, label, closeLabel, onClose }: { presenting: boolean; label: string; closeLabel: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2.5 border-b border-white/10">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-black ${presenting ? "bg-emerald-500 text-black" : "bg-sky-500 text-black"}`}>
          {presenting ? "🎤 설명 중" : "👀 관람 중"}
        </span>
        <span className="text-white text-sm font-bold truncate">{label}</span>
      </div>
      <button onClick={onClose} className="shrink-0 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm font-bold">{closeLabel}</button>
    </div>
  );
}

/** 전술판을 화면 가운데에 세로 비율(5:7)을 지키며 가능한 크게 놓는다 */
function PitchFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center px-3 py-2" style={{ containerType: "size" }}>
      <div style={{ width: "min(100cqw, calc(100cqh * 5 / 7))", height: "min(100cqh, calc(100cqw * 7 / 5))" }}>{children}</div>
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center px-8 text-center text-gray-400 text-sm leading-relaxed whitespace-pre-line">{children}</div>;
}

// ── 설명하는 사람: 판 고르기 ──
function BoardPicker({ otherPresenter, onPick, onCancel }: { otherPresenter: Presenter | null; onPick: (b: BoardSnapshot) => void; onCancel?: () => void }) {
  const [list, setList] = useState<{ id: string; title: string; formation_name: string }[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [formation, setFormation] = useState(SOCCER_FORMATIONS.includes("4-3-3") ? "4-3-3" : SOCCER_FORMATIONS[0]);

  useEffect(() => {
    let off = false;
    fetch("/api/tactics")
      .then(r => (r.ok ? r.json() : Promise.reject(new Error("load"))))
      .then(d => { if (!off) setList(Array.isArray(d) ? d : []); })
      .catch(() => { if (!off) { setList([]); setError("저장해 둔 전술판을 불러오지 못했어요. 포메이션으로 시작할 수는 있어요."); } });
    return () => { off = true; };
  }, []);

  async function pickSaved(id: string) {
    setLoadingId(id);
    setError("");
    try {
      const r = await fetch(`/api/tactics/${id}`);
      if (!r.ok) throw new Error("load");
      const d = await r.json();
      const board = sanitizeBoard({ title: d.title, tokens: d.tokens, arrows: d.arrows });
      if (!board || board.tokens.length === 0) throw new Error("empty");
      onPick(board);
    } catch {
      setError("전술판을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4" style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}>
      {otherPresenter && (
        <p className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
          지금 {otherPresenter.name}님이 설명 중이에요. 시작하면 두 판이 동시에 열려요.
        </p>
      )}
      <div>
        <h3 className="text-white font-black text-sm mb-2">어떤 판으로 설명할까요?</h3>
        <p className="text-gray-500 text-[11px] mb-2">설명하며 옮기거나 그린 내용은 보는 사람에게만 보이고, 저장된 전술판은 바뀌지 않아요.</p>
        <div className="flex gap-2">
          <select
            value={formation}
            onChange={e => setFormation(e.target.value)}
            className="flex-1 min-w-0 h-10 rounded-xl bg-gray-800 border border-white/10 text-white text-base px-3 outline-none"
          >
            {SOCCER_FORMATIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button onClick={() => onPick(boardFromFormation(formation))} className="h-10 px-4 rounded-xl bg-emerald-500 text-black font-bold text-sm shrink-0">
            이 포메이션으로
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-white font-black text-sm mb-2">저장해 둔 전술판</h3>
        {list === null ? (
          <p className="text-gray-500 text-sm">불러오는 중…</p>
        ) : list.length === 0 ? (
          <p className="text-gray-500 text-sm">{error ? "" : "저장해 둔 전술판이 없어요"}</p>
        ) : (
          <div className="space-y-1.5">
            {list.map(b => (
              <button
                key={b.id}
                onClick={() => void pickSaved(b.id)}
                disabled={loadingId !== null}
                className="w-full text-left bg-gray-800 hover:bg-gray-800/70 disabled:opacity-60 border border-white/5 rounded-xl px-3 py-2.5"
              >
                <p className="text-sm font-bold text-white">{loadingId === b.id ? "불러오는 중…" : b.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{b.formation_name}</p>
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-amber-300 text-xs mt-2">{error}</p>}
      </div>

      {onCancel && <button onClick={onCancel} className="w-full bg-white/5 text-gray-300 font-bold py-2.5 rounded-xl text-sm">취소</button>}
    </div>
  );
}

// ── 설명하는 사람 화면 ──
function PresentView({ presenters, onSetTactic, onClose }: { presenters: Presenter[]; onSetTactic: (b: BoardSnapshot | null) => void; onClose: () => void }) {
  const [board, setBoard] = useState<BoardSnapshot | null>(null);
  const [picking, setPicking] = useState(true);
  const [tool, setTool] = useState<"draw" | "move">("draw"); // 선 긋기 중에는 선수가 고정된다. 선수를 옮기려면 '선수 이동'
  const [lineType, setLineType] = useState<LineType>("move");
  const [lineMode, setLineMode] = useState<LineMode>("curve");
  const startRef = useRef<BoardSnapshot | null>(null); // "처음 배치"로 되돌리는 용도
  const onSetTacticRef = useRef(onSetTactic);
  onSetTacticRef.current = onSetTactic;

  // 이 화면이 어떤 이유로든 사라지면(설명 끝내기·방 나가기) 방에 보이던 판도 내린다
  useEffect(() => () => onSetTacticRef.current(null), []);

  function apply(next: BoardSnapshot) {
    setBoard(next);
    onSetTactic(next);
  }
  function pick(b: BoardSnapshot) {
    startRef.current = b;
    setPicking(false);
    apply(b);
  }
  function endPresenting() {
    onSetTactic(null);
    onClose();
  }

  const btn = (active: boolean) => `px-2.5 py-1.5 rounded-lg text-xs font-bold border ${active ? "bg-white/15 border-white/25 text-white" : "bg-gray-900 border-white/10 text-gray-400"}`;

  return (
    <>
      <PanelHeader presenting label={board?.title || "전술판"} closeLabel="설명 끝내기" onClose={endPresenting} />
      {picking || !board ? (
        <BoardPicker otherPresenter={presenters[0] ?? null} onPick={pick} onCancel={board ? () => setPicking(false) : undefined} />
      ) : (
        <>
          <div className="px-3 pt-2 flex flex-wrap items-center gap-1.5">
            {(["move", "pass"] as LineType[]).map(t => {
              const active = tool === "draw" && lineType === t;
              return (
                <button key={t} onClick={() => { setTool("draw"); setLineType(t); }} className={btn(active)} style={active ? { borderColor: LINE_COLORS[t], color: LINE_COLORS[t] } : undefined}>
                  {LINE_LABELS[t]}
                </button>
              );
            })}
            <button onClick={() => setTool("move")} className={btn(tool === "move")}>✋ 선수 이동</button>
            <span className="w-px h-5 bg-white/10 mx-0.5" />
            <button onClick={() => setLineMode("curve")} className={btn(lineMode === "curve")}>곡선</button>
            <button onClick={() => setLineMode("straight")} className={btn(lineMode === "straight")}>직선</button>
            <span className="w-px h-5 bg-white/10 mx-0.5" />
            <button onClick={() => board.arrows.length > 0 && apply({ ...board, arrows: board.arrows.slice(0, -1) })} disabled={board.arrows.length === 0} className={`${btn(false)} disabled:opacity-40`}>↩ 선 하나 지우기</button>
            <button onClick={() => apply({ ...board, arrows: [] })} disabled={board.arrows.length === 0} className={`${btn(false)} disabled:opacity-40`}>선 모두 지우기</button>
            <button onClick={() => startRef.current && apply(startRef.current)} className={btn(false)}>처음 배치로</button>
            <button onClick={() => setPicking(true)} className={btn(false)}>판 바꾸기</button>
          </div>
          <p className="px-4 pt-1.5 text-gray-500 text-[11px]">
            {tool === "draw" ? "선을 그을 땐 선수가 그 자리에 고정돼요. 선수를 옮기려면 ✋ 선수 이동을 누르세요." : "선수를 끌어 옮기세요. 선을 그리려면 움직임·패스를 누르세요."} 하는 대로 보는 사람에게 바로 보여요.
          </p>
          <PitchFrame>
            <TacticsPitch tokens={board.tokens} arrows={board.arrows} editable tool={tool} lineType={lineType} lineMode={lineMode} onChange={(tokens, arrows) => apply({ ...board, tokens, arrows })} />
          </PitchFrame>
        </>
      )}
    </>
  );
}

// ── 보는 사람 화면 ──
function WatchView({ presenters, onClose }: { presenters: Presenter[]; onClose: () => void }) {
  const [followKey, setFollowKey] = useState<string | null>(null);
  const current = presenters.find(p => p.key === followKey) ?? presenters[0] ?? null;
  return (
    <>
      <PanelHeader presenting={false} label={current ? `${current.name}님의 전술판${current.board.title ? ` · ${current.board.title}` : ""}` : "전술판"} closeLabel="나가기" onClose={onClose} />
      {presenters.length > 1 && (
        <div className="px-3 pt-2 flex flex-wrap gap-1.5">
          {presenters.map(p => (
            <button
              key={p.key}
              onClick={() => setFollowKey(p.key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${p.key === current?.key ? "bg-sky-500 border-sky-400 text-black" : "bg-gray-900 border-white/10 text-gray-300"}`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      {current ? (
        <PitchFrame>
          <TacticsPitch tokens={current.board.tokens} arrows={current.board.arrows} />
        </PitchFrame>
      ) : (
        <EmptyNote>{"지금 전술을 설명하는 사람이 없어요.\n설명이 시작되면 이 화면에 바로 나타나요."}</EmptyNote>
      )}
    </>
  );
}

// 화면 아래 채팅 입력줄(바닥 UI)이 보이도록 패널이 그만큼 비워 두는 높이
const CHAT_BAR_SPACE = "calc(max(env(safe-area-inset-bottom), 16px) + 56px)";

/**
 * 전술 구역에서 버튼을 눌렀을 때 화면을 덮는 전술 화면.
 * 설명하는 사람(present)은 판을 고르고 선수를 옮기거나 선을 그리고, 그 모습이 방 전체에 실시간으로 전달된다.
 * 보는 사람(watch)은 설명 중인 사람의 판을 읽기 전용으로 본다. 설명하는 사람이 없으면 시작될 때까지 기다린다.
 * 아래쪽 채팅 입력줄은 가리지 않고, 최근 대화 몇 줄을 보여 줘서 보면서 의견을 나눌 수 있다.
 */
export default function TacticsSessionPanel({
  mode,
  presenters,
  messages,
  onSetTactic,
  onClose,
}: {
  mode: TacticsMode;
  presenters: Presenter[];
  messages: ChatMessage[];
  onSetTactic: (board: BoardSnapshot | null) => void;
  onClose: () => void;
}) {
  const recent = messages.slice(-3);
  return (
    <div
      className="absolute inset-x-0 top-0 z-50 bg-gray-950 flex flex-col"
      style={{ bottom: CHAT_BAR_SPACE }}
      // 이 화면 위의 터치·휠이 뒤의 3D 카메라 확대/축소로 번지지 않게 막는다
      onPointerDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      {mode === "present" ? (
        <PresentView presenters={presenters} onSetTactic={onSetTactic} onClose={onClose} />
      ) : (
        <WatchView presenters={presenters} onClose={onClose} />
      )}
      {recent.length > 0 && (
        <div className="px-4 pb-1.5 pt-1 space-y-0.5 border-t border-white/5 pointer-events-none">
          {recent.map(m => (
            <p key={m.id} className="text-xs text-gray-300 truncate">
              <span className={`font-bold ${m.mine ? "text-emerald-300" : "text-sky-300"}`}>{m.mine ? "나" : m.name}</span> {m.text}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
