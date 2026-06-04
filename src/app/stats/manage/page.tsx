"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

interface Entry {
  member_id:    string;
  name:         string;
  goals:        number;
  assists:      number;
  games_played: number;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function StatsManagePage() {
  const { status } = useSession();
  const router     = useRouter();

  const [baseYear, setBaseYear] = useState(CURRENT_YEAR);
  const [year,     setYear]     = useState(CURRENT_YEAR);
  const windowYears = [baseYear, baseYear + 1, baseYear + 2];

  const [entries,            setEntries]            = useState<Entry[]>([]);
  const [registeredMatches,  setRegisteredMatches]  = useState(0);
  const [extraMatches,       setExtraMatches]       = useState(0);
  const [loading,            setLoading]            = useState(true);
  const [saving,             setSaving]             = useState(false);
  const [savedToast,         setSavedToast]         = useState(false);

  const totalMatches = registeredMatches + extraMatches;

  useEffect(() => {
    if (status === "unauthenticated") { router.push("/"); return; }
    if (status === "authenticated") { checkRoleAndFetch(CURRENT_YEAR); }
  }, [status]);

  async function checkRoleAndFetch(y: number) {
    const profile = await fetch("/api/user/profile").then(r => r.json());
    const role    = profile.role ?? null;
    if (role !== "owner" && role !== "manager" && role !== "president") {
      router.push("/stats");
      return;
    }
    fetchStats(y);
  }

  async function fetchStats(y: number) {
    setLoading(true);
    const res  = await fetch(`/api/player-stats?year=${y}`);
    const data = await res.json();

    setRegisteredMatches(data.registered_matches ?? 0);
    setExtraMatches(data.extra_matches ?? 0);
    setEntries(
      (Array.isArray(data.members) ? data.members : []).map(
        (d: { id?: string; member_id?: string; name: string; goals: number; assists: number; games_played: number }) => ({
          member_id:    d.member_id ?? d.id ?? "",
          name:         d.name,
          goals:        d.goals,
          assists:      d.assists,
          games_played: d.games_played,
        })
      )
    );
    setLoading(false);
  }

  function switchYear(y: number) { setYear(y); fetchStats(y); }
  function shiftWindow(delta: number) { const nb = baseYear + delta; setBaseYear(nb); switchYear(nb); }

  function updateEntry(memberId: string, field: keyof Omit<Entry, "member_id" | "name">, delta: number) {
    setEntries(prev => prev.map(e =>
      e.member_id === memberId ? { ...e, [field]: Math.max(0, e[field] + delta) } : e
    ));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/player-stats", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ year, extra_matches: extraMatches, entries }),
    });
    setSaving(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2000);
  }

  return (
    <AppLayout title="통계 관리">
      <div className="max-w-2xl mx-auto px-4 py-6">

        <button onClick={() => router.push("/stats")}
          className="text-sm text-gray-500 hover:text-white transition-colors mb-4 flex items-center gap-1">
          ← 통계 보기로
        </button>

        {/* 연도 선택 */}
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => shiftWindow(-1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors shrink-0">‹</button>
          <div className="flex gap-1.5 flex-1 bg-gray-900 border border-white/5 rounded-xl p-1.5">
            {windowYears.map(y => (
              <button key={y} onClick={() => switchYear(y)}
                className={`flex-1 text-sm font-bold py-1.5 rounded-lg transition-colors ${
                  year === y ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"
                }`}>{y}년</button>
            ))}
          </div>
          <button onClick={() => shiftWindow(1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors shrink-0">›</button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3 opacity-20">👥</div>
            <p className="text-gray-600 text-sm">팀원이 없어요</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">

            {/* 컬럼 헤더 */}
            <div className="grid grid-cols-[1fr_96px_96px_96px] items-center px-4 py-2.5 border-b border-white/10 bg-white/3">
              <span className="text-xs text-gray-500 font-semibold">선수</span>
              <span className="text-xs text-gray-400 font-semibold text-center">🏃 출전</span>
              <span className="text-xs text-emerald-400 font-semibold text-center">🥅 골</span>
              <span className="text-xs text-blue-400 font-semibold text-center">🎯 어시</span>
            </div>

            {/* 선수별 행 */}
            <div className="divide-y divide-white/5">
              {entries.map(entry => (
                <div key={entry.member_id}
                  className="grid grid-cols-[1fr_96px_96px_96px] items-center px-4 py-2">
                  <span className="text-sm font-medium text-white truncate pr-2">{entry.name}</span>

                  <Counter
                    value={entry.games_played}
                    onChange={d => updateEntry(entry.member_id, "games_played", d)}
                    color="gray"
                  />
                  <Counter
                    value={entry.goals}
                    onChange={d => updateEntry(entry.member_id, "goals", d)}
                    color="emerald"
                  />
                  <Counter
                    value={entry.assists}
                    onChange={d => updateEntry(entry.member_id, "assists", d)}
                    color="blue"
                  />
                </div>
              ))}
            </div>

            {/* 총 경기수 */}
            <div className="border-t border-white/10 px-4 py-4 bg-white/3 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-gray-400">📅 총 경기수 · 참석률 계산 기준</p>

              {/* 등록 경기 (자동) */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">경기 관리 등록</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-white">{registeredMatches}</span>
                  <span className="text-xs text-gray-600">경기 · 자동</span>
                </div>
              </div>

              {/* 추가 경기 (수동) */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-400">미등록 추가 경기</span>
                  <p className="text-[11px] text-gray-700 mt-0.5">시스템에 없는 경기</p>
                </div>
                <Counter
                  value={extraMatches}
                  onChange={d => setExtraMatches(prev => Math.max(0, prev + d))}
                  color="gray"
                />
              </div>

              {/* 합계 */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-sm font-bold text-white">합계</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-lg font-black text-emerald-400">{totalMatches}</span>
                  <span className="text-sm text-gray-500">경기</span>
                </div>
              </div>
            </div>

            {/* 저장 */}
            <div className="px-4 py-4 border-t border-white/10">
              <button onClick={save} disabled={saving}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-colors">
                {saving ? "저장 중..." : "💾 저장"}
              </button>
            </div>
          </div>
        )}
      </div>

      {savedToast && (
        <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-800 border border-white/10 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-lg whitespace-nowrap">
          ✅ 저장됐어요!
        </div>
      )}
    </AppLayout>
  );
}

/* ── +/- 카운터 버튼 ── */
function Counter({ value, onChange, color }: {
  value: number;
  onChange: (delta: number) => void;
  color: "gray" | "emerald" | "blue";
}) {
  const numColor = {
    gray:    value > 0 ? "text-white"        : "text-gray-700",
    emerald: value > 0 ? "text-emerald-400"  : "text-gray-700",
    blue:    value > 0 ? "text-blue-400"     : "text-gray-700",
  }[color];

  const plusCls = {
    gray:    "bg-white/5 hover:bg-white/10 text-gray-400",
    emerald: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400",
    blue:    "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400",
  }[color];

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onChange(-1)}
        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-sm flex items-center justify-center transition-colors"
      >−</button>
      <span className={`text-sm font-black w-6 text-center ${numColor}`}>{value}</span>
      <button
        onClick={() => onChange(1)}
        className={`w-7 h-7 rounded-lg font-bold text-sm flex items-center justify-center transition-colors ${plusCls}`}
      >+</button>
    </div>
  );
}
