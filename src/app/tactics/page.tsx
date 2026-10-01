"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PenTool, Check } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import ScrimmageSelect from "@/components/ScrimmageSelect";
import { FORMATIONS } from "@/lib/formations";

interface TacticsBoard {
  id: string;
  title: string;
  formation_name: string;
  published: boolean;
  created_at: string;
  updated_at: string;
}

const SOCCER_FORMATION_NAMES = Object.keys(FORMATIONS).filter(k => FORMATIONS[k].type === "soccer");

export default function TacticsListPage() {
  const router = useRouter();
  const [boards, setBoards] = useState<TacticsBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [formationName, setFormationName] = useState("4-3-3");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch("/api/tactics");
    if (res.ok) setBoards(await res.json());
    setLoading(false);
  }

  async function createBoard() {
    if (!title.trim()) return;
    setCreating(true);
    const res = await fetch("/api/tactics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        formation_name: formationName,
        tokens: FORMATIONS[formationName].slots.map(s => ({ id: s.id, x: s.x, y: s.y, team: "us", label: s.label })),
        arrows: [],
      }),
    });
    setCreating(false);
    if (res.ok) {
      const board = await res.json();
      router.push(`/tactics/${board.id}`);
    }
  }

  return (
    <AppLayout title="전술판">
      <div className="max-w-lg mx-auto px-3 py-4 space-y-4">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-colors"
        >
          <Plus size={16} /> 새 전술판 만들기
        </button>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : boards.length === 0 ? (
          <div className="text-center py-14 bg-gray-900 border border-white/5 rounded-lg">
            <PenTool size={28} strokeWidth={1.5} className="opacity-30 mx-auto mb-3" />
            <p className="text-sm text-gray-500">아직 만든 전술판이 없어요</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-white/5 rounded-lg overflow-hidden">
            {boards.map((b, i) => (
              <button
                key={b.id}
                onClick={() => router.push(`/tactics/${b.id}`)}
                className={`w-full text-left flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors ${i < boards.length - 1 ? "border-b border-white/[0.03]" : ""}`}
              >
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    {b.title}
                    {b.published && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                        <Check size={9} /> 게시됨
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">{b.formation_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-bold text-white mb-4">새 전술판 만들기</h2>
            <label className="text-xs text-gray-500 mb-1 block">이름</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 코너킥 전술, 역습 패턴"
              className="w-full bg-gray-800 border border-white/10 text-white rounded-xl px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-gray-600"
            />
            <label className="text-xs text-gray-500 mb-1 block">포메이션</label>
            <div className="mb-4">
              <ScrimmageSelect
                value={formationName}
                onChange={setFormationName}
                placeholder="포메이션 선택"
                options={SOCCER_FORMATION_NAMES.map(name => ({ value: name, label: name }))}
              />
            </div>
            <button
              onClick={createBoard}
              disabled={!title.trim() || creating}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-3 rounded-xl font-bold transition-colors"
            >
              {creating ? "만드는 중..." : "만들기"}
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
