"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

interface Entry {
  member_id:     string;
  name:          string;
  auto_goals:    number;  // match_stats 자동 집계 (읽기전용)
  auto_assists:  number;  // match_stats 자동 집계 (읽기전용)
  extra_goals:   number;  // 미등록 경기 추가 골 (수동 입력)
  extra_assists: number;  // 미등록 경기 추가 어시 (수동 입력)
  auto_games:    number;  // match_attendees 자동 (읽기전용)
  extra_games:   number;  // 미등록 추가 출전 (수동 입력)
}

const CURRENT_YEAR = new Date().getFullYear();

export default function StatsManagePage() {
  const { status } = useSession();
  const router     = useRouter();

  const [baseYear, setBaseYear] = useState(CURRENT_YEAR);
  const [year,     setYear]     = useState(CURRENT_YEAR);
  const windowYears = [baseYear, baseYear + 1, baseYear + 2];

  const [entries,           setEntries]           = useState<Entry[]>([]);
  const [registeredMatches, setRegisteredMatches] = useState(0);
  const [extraMatches,      setExtraMatches]      = useState(0);
  const [loading,           setLoading]           = useState(true);
  const [saving,            setSaving]            = useState(false);
  const [savedToast,        setSavedToast]        = useState(false);

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
        (d: { id?: string; member_id?: string; name: string; auto_goals: number; auto_assists: number; extra_goals: number; extra_assists: number; auto_games: number; extra_games: number }) => ({
          member_id:     d.member_id ?? d.id ?? "",
          name:          d.name,
          auto_goals:    d.auto_goals    ?? 0,
          auto_assists:  d.auto_assists  ?? 0,
          extra_goals:   d.extra_goals   ?? 0,
          extra_assists: d.extra_assists ?? 0,
          auto_games:    d.auto_games    ?? 0,
          extra_games:   d.extra_games   ?? 0,
        })
      )
    );
    setLoading(false);
  }

  function switchYear(y: number) { setYear(y); fetchStats(y); }
  function shiftWindow(delta: number) { const nb = baseYear + delta; setBaseYear(nb); switchYear(nb); }

  function updateEntry(memberId: string, field: "extra_goals" | "extra_assists" | "extra_games", delta: number) {
    setEntries(prev => prev.map(e =>
      e.member_id === memberId ? { ...e, [field]: Math.max(0, e[field] + delta) } : e
    ));
  }

  async function save() {
    setSaving(true);
    await fetch("/api/player-stats", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        year,
        extra_matches: extraMatches,
        entries: entries.map(e => ({
          member_id:   e.member_id,
          goals:       e.extra_goals,    // player_stats에는 추가분만 저장
          assists:     e.extra_assists,
          extra_games: e.extra_games,
        })),
      }),
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

            {/* 안내 배너 */}
            <div className="px-4 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-start gap-2">
              <span className="text-emerald-400 shrink-0 mt-0.5">💡</span>
              <p className="text-[11px] text-emerald-300/70 leading-relaxed">
                <span className="font-bold text-emerald-400">골·어시는 경기관리에서 자동 집계</span>됩니다.
                여기서는 앱에 등록되지 않은 경기의 추가 기록만 입력하세요.
              </p>
            </div>

            {/* 컬럼 헤더 */}
            <div className="grid grid-cols-[1fr_60px_80px_100px_100px] items-center px-4 py-2.5 border-b border-white/10 bg-white/3">
              <span className="text-xs text-gray-500 font-semibold">선수</span>
              <span className="text-xs text-gray-400 font-semibold text-center">🏃 자동</span>
              <span className="text-xs text-amber-400 font-semibold text-center">➕ 추가출전</span>
              <span className="text-xs text-emerald-400 font-semibold text-center">🥅 골</span>
              <span className="text-xs text-blue-400 font-semibold text-center">🎯 어시</span>
            </div>

            {/* 선수별 행 */}
            <div className="divide-y divide-white/5">
              {entries.map(entry => (
                <div key={entry.member_id}
                  className="grid grid-cols-[1fr_60px_80px_100px_100px] items-center px-4 py-2.5">
                  <span className="text-sm font-medium text-white truncate pr-2">{entry.name}</span>

                  {/* 자동 출전 (읽기전용) */}
                  <div className="flex items-center justify-center">
                    <span className={`text-sm font-black ${entry.auto_games > 0 ? "text-gray-300" : "text-gray-700"}`}>
                      {entry.auto_games}
                    </span>
                  </div>

                  {/* 추가 출전 (+/- 버튼) */}
                  <Counter
                    value={entry.extra_games}
                    onChange={d => updateEntry(entry.member_id, "extra_games", d)}
                    color="amber"
                  />

                  {/* 골: 자동(읽기전용) + 추가(수동) */}
                  <div className="flex flex-col items-center gap-0.5">
                    {entry.auto_goals > 0 && (
                      <span className="text-[10px] text-emerald-500/60 font-semibold">자동 {entry.auto_goals}골</span>
                    )}
                    <div className="flex items-center gap-0.5">
                      <Counter
                        value={entry.extra_goals}
                        onChange={d => updateEntry(entry.member_id, "extra_goals", d)}
                        color="emerald"
                      />
                    </div>
                    {entry.extra_goals > 0 && (
                      <span className="text-[10px] text-gray-600">추가</span>
                    )}
                  </div>

                  {/* 어시: 자동(읽기전용) + 추가(수동) */}
                  <div className="flex flex-col items-center gap-0.5">
                    {entry.auto_assists > 0 && (
                      <span className="text-[10px] text-blue-500/60 font-semibold">자동 {entry.auto_assists}도움</span>
                    )}
                    <div className="flex items-center gap-0.5">
                      <Counter
                        value={entry.extra_assists}
                        onChange={d => updateEntry(entry.member_id, "extra_assists", d)}
                        color="blue"
                      />
                    </div>
                    {entry.extra_assists > 0 && (
                      <span className="text-[10px] text-gray-600">추가</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* 총 경기수 섹션 */}
            <div className="border-t border-white/10 px-4 py-4 bg-white/3 flex flex-col gap-2.5">
              <p className="text-xs font-semibold text-gray-400">📅 총 경기수 · 참석률 계산 기준</p>

              {/* 자동 안내 */}
              <div className="bg-white/3 border border-white/5 rounded-xl px-3 py-2">
                <p className="text-[11px] text-gray-500 mb-1.5 font-semibold">🏃 자동 출전 수 계산 방식</p>
                <p className="text-[11px] text-gray-600">경기 배정 페이지에서 참석 체크 시 자동 반영돼요</p>
              </div>

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

            {/* 저장 버튼 */}
            <div className="px-4 py-4 border-t border-white/10">
              <p className="text-[11px] text-gray-600 mb-3 text-center">
                💡 골·어시는 경기관리에서 자동 반영 · 미등록 경기 추가분과 추가출전만 저장돼요
              </p>
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
  color: "gray" | "emerald" | "blue" | "amber";
}) {
  const numColor = {
    gray:    value > 0 ? "text-white"       : "text-gray-700",
    emerald: value > 0 ? "text-emerald-400" : "text-gray-700",
    blue:    value > 0 ? "text-blue-400"    : "text-gray-700",
    amber:   value > 0 ? "text-amber-400"   : "text-gray-700",
  }[color];

  const plusCls = {
    gray:    "bg-white/5 hover:bg-white/10 text-gray-400",
    emerald: "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400",
    blue:    "bg-blue-500/20 hover:bg-blue-500/30 text-blue-400",
    amber:   "bg-amber-500/20 hover:bg-amber-500/30 text-amber-400",
  }[color];

  return (
    <div className="flex items-center justify-center gap-0.5">
      <button onClick={() => onChange(-1)}
        className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 font-bold text-sm flex items-center justify-center transition-colors">−</button>
      <span className={`text-sm font-black w-5 text-center ${numColor}`}>{value}</span>
      <button onClick={() => onChange(1)}
        className={`w-6 h-6 rounded-lg font-bold text-sm flex items-center justify-center transition-colors ${plusCls}`}>+</button>
    </div>
  );
}
