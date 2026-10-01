"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, Undo2, Trash2, X, ChevronLeft, Check, Trash, Save } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ScrimmageSelect from "@/components/ScrimmageSelect";
import { FORMATIONS } from "@/lib/formations";

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
  team: "us" | "opp";
  label?: string;
}

const SOCCER_FORMATION_NAMES = Object.keys(FORMATIONS).filter(k => FORMATIONS[k].type === "soccer");

function uid() {
  return Math.random().toString(36).slice(2);
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
  const [tokens, setTokens] = useState<Token[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [draft, setDraft] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [lineMode, setLineMode] = useState<LineMode>("curve");
  const [lineType, setLineType] = useState<LineType>("move");

  const pitchRef = useRef<HTMLDivElement>(null);

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
  }, [id]);

  function pointFromEvent(e: { clientX: number; clientY: number }) {
    const rect = pitchRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  }

  function handlePitchPointerDown(e: React.PointerEvent) {
    if (!editable || draggingId) return;
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
    if (!draft) return;
    const { x, y } = pointFromEvent(e);
    setDraft(d => (d ? { ...d, x2: x, y2: y } : d));
  }

  function handlePitchPointerUp() {
    if (!editable) return;
    if (draggingId) {
      setDraggingId(null);
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

  function changeFormation(name: string) {
    setFormationName(name);
    const slots = FORMATIONS[name].slots;
    setTokens(prev => [
      ...slots.map(s => ({ id: s.id, x: s.x, y: s.y, team: "us" as const, label: s.label })),
      ...prev.filter(t => t.team === "opp"),
    ]);
    setDirty(true);
  }

  function addOpponent() {
    setTokens(prev => [...prev, { id: uid(), x: 50, y: 50, team: "opp" }]);
    setDirty(true);
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
      body: JSON.stringify({ title, formation_name: formationName, tokens, arrows }),
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
              value={formationName}
              onChange={changeFormation}
              placeholder="포메이션 선택"
              options={SOCCER_FORMATION_NAMES.map(name => ({ value: name, label: name }))}
            />
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

            <div className="flex items-center gap-2">
              <button
                onClick={addOpponent}
                className="flex items-center gap-1.5 text-xs font-bold bg-gray-900 border border-white/10 hover:border-white/20 text-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                <Plus size={14} /> 상대 추가
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
          </>
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

          {/* 화살표 순서 번호 — 움직임/패스 각각 따로 1번부터 */}
          {(() => {
            const seqByType: Record<LineType, number> = { move: 0, pass: 0 };
            return arrows.map(a => {
              seqByType[a.type] += 1;
              const pos = arrowLabelPos(a);
              return (
                <div
                  key={a.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-white shadow pointer-events-none"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, background: LINE_COLORS[a.type] }}
                >
                  {seqByType[a.type]}
                </div>
              );
            });
          })()}

          {tokens.map(t => (
            <div
              key={t.id}
              onPointerDown={e => { if (editable) { e.stopPropagation(); setDraggingId(t.id); } }}
              className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full border-2 shadow-lg text-[10px] font-black ${
                t.team === "us" ? "bg-emerald-400 border-emerald-300 text-gray-900" : "bg-white border-gray-300 text-gray-900"
              } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
              style={{ left: `${t.x}%`, top: `${t.y}%` }}
            >
              {t.label}
              {editable && t.team === "opp" && (
                <button
                  onPointerDown={e => e.stopPropagation()}
                  onClick={() => removeToken(t.id)}
                  className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-gray-900 border border-white/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
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
    </AppLayout>
  );
}
