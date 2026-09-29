"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Swords, Plus, X } from "lucide-react";
import AppLayout from "@/components/AppLayout";

interface Scrimmage {
  id: string;
  title: string | null;
  sport: "soccer" | "futsal";
  match_date: string | null;
  squad_count: number;
  created_at: string;
}

const SPORT_LABEL: Record<string, string> = { soccer: "축구", futsal: "풋살" };

export default function ScrimmagePage() {
  const { status } = useSession();
  const router = useRouter();
  const [scrimmages, setScrimmages] = useState<Scrimmage[]>([]);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const [title, setTitle] = useState("");
  const [sport, setSport] = useState<"soccer" | "futsal">("futsal");
  const [matchDate, setMatchDate] = useState("");
  const [squadCount, setSquadCount] = useState(2);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchScrimmages();
      fetchRole();
    }
  }, [status]);

  async function fetchRole() {
    const res = await fetch("/api/user/profile");
    const data = await res.json();
    const role = data.role ?? null;
    setCanManage(role === "owner" || role === "manager" || role === "coach" || role === "president");
  }

  async function fetchScrimmages() {
    setLoading(true);
    const res = await fetch("/api/scrimmages");
    const data = await res.json();
    setScrimmages(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  async function handleCreate() {
    if (!matchDate) return alert("날짜를 선택해주세요");
    setCreating(true);
    const res = await fetch("/api/scrimmages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, sport, match_date: matchDate, squad_count: squadCount }),
    });
    setCreating(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/scrimmage/${data.id}`);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "생성 실패");
    }
  }

  const formatDate = (d: string | null) =>
    d ? new Date(d.replace(/-/g, "/")).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" }) : "";

  return (
    <AppLayout
      title="내전"
      helpContent={{
        items: [
          { icon: "⚔️", title: "내전 만들기", desc: "팀 내에서 편을 나눠 경기할 때 사용해요. 2~4팀으로 나누고 팀별로 포지션을 짜요." },
          { icon: "🔗", title: "공유하기", desc: "완성된 라인업을 링크로 팀원들에게 공유할 수 있어요." },
        ],
      }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-5">
          <p className="text-xs text-gray-600 uppercase tracking-widest">내전 {scrimmages.length}건</p>
          {canManage && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-2 rounded-xl text-sm transition-colors"
            >
              <Plus size={16} /> 내전 만들기
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : scrimmages.length === 0 ? (
          <div className="text-center py-16">
            <Swords size={40} strokeWidth={1.5} className="opacity-30 mx-auto mb-3" />
            <p className="text-gray-600">아직 내전이 없어요</p>
            {canManage && <p className="text-sm text-gray-700 mt-1">팀을 나눠서 경기해보세요!</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {scrimmages.map(s => (
              <button
                key={s.id}
                onClick={() => router.push(`/scrimmage/${s.id}`)}
                className="text-left bg-gray-900 border border-white/5 rounded-lg px-5 py-4 flex items-center justify-between hover:border-white/10 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white">{s.title || `${formatDate(s.match_date)} 내전`}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {formatDate(s.match_date)} · {SPORT_LABEL[s.sport]} · {s.squad_count}파전
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">내전 만들기</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">제목 (선택)</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="예: 9월 정기 내전"
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none placeholder-gray-600"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">날짜</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={e => setMatchDate(e.target.value)}
                  className="w-full bg-gray-800 border border-white/10 focus:border-emerald-500 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">종목</label>
                <div className="grid grid-cols-2 gap-2">
                  {(["futsal", "soccer"] as const).map(sp => (
                    <button
                      key={sp}
                      onClick={() => setSport(sp)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        sport === sp ? "bg-emerald-500 text-black" : "bg-gray-800 text-gray-400 border border-white/10"
                      }`}
                    >
                      {SPORT_LABEL[sp]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">몇 팀으로 나눌까요?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setSquadCount(n)}
                      className={`py-2.5 rounded-xl text-sm font-bold transition-colors ${
                        squadCount === n ? "bg-emerald-500 text-black" : "bg-gray-800 text-gray-400 border border-white/10"
                      }`}
                    >
                      {n}팀
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={creating}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black py-3 rounded-xl font-bold transition-colors mt-2"
              >
                {creating ? "만드는 중..." : "만들기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
