"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";

interface PlayerStat {
  id: string;
  name: string;
  is_me?: boolean;
  goals: number;
  assists: number;
  attended: number;
  total_matches: number;
  attendance_rate: number;
}

type SortKey = "goals" | "assists" | "attendance_rate" | "name";

const CURRENT_YEAR = new Date().getFullYear();

export default function StatsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [stats, setStats]     = useState<PlayerStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort]       = useState<SortKey>("goals");
  const [year, setYear]       = useState(String(CURRENT_YEAR));
  const [userRole, setUserRole] = useState<string | null>(null);
  // 3개 연도 윈도우의 시작 연도
  const [baseYear, setBaseYear] = useState(CURRENT_YEAR);

  // 현재 윈도우에 보여줄 3개 연도
  const windowYears = [baseYear, baseYear + 1, baseYear + 2].map(String);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/");
    if (status === "authenticated") {
      fetchStats(year);
      fetch("/api/user/profile").then(r => r.json()).then(d => setUserRole(d.role ?? null));
    }
  }, [status]);

  const canManageStats = userRole === "owner" || userRole === "manager" || userRole === "president";

  async function fetchStats(y: string) {
    setLoading(true);
    const res  = await fetch(`/api/stats?year=${y}`);
    const data = await res.json();
    setStats(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  function switchYear(y: string) {
    setYear(y);
    fetchStats(y);
  }

  function shiftWindow(delta: number) {
    const newBase = baseYear + delta;
    setBaseYear(newBase);
    // 선택 연도도 같이 이동
    const newYear = String(newBase);
    setYear(newYear);
    fetchStats(newYear);
  }

  // 전체 정렬 (순위 계산용)
  const fullSorted = [...stats].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]
  );
  const rankMap = Object.fromEntries(fullSorted.map((p, i) => [p.id, i + 1]));

  // 나를 맨 위로, 나머지는 정렬 순
  const me     = stats.find(p => p.is_me);
  const others = fullSorted.filter(p => !p.is_me);
  const sorted = me ? [me, ...others] : others;

  const topScorer     = [...stats].sort((a, b) => b.goals           - a.goals)[0];
  const topAssister   = [...stats].sort((a, b) => b.assists         - a.assists)[0];
  const topAttendance = [...stats].sort((a, b) => b.attendance_rate - a.attendance_rate)[0];
  const totalMatches  = stats[0]?.total_matches ?? 0;

  return (
    <AppLayout title="팀 통계">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* 연도 탭 + 화살표 */}
        <div className="flex items-center gap-2 mb-5">
          {/* 이전 */}
          <button
            onClick={() => shiftWindow(-1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors shrink-0 text-sm"
          >
            ‹
          </button>

          {/* 연도 3개 */}
          <div className="flex gap-1.5 flex-1 bg-gray-900 border border-white/5 rounded-xl p-1.5">
            {windowYears.map(y => (
              <button
                key={y}
                onClick={() => switchYear(y)}
                className={`flex-1 text-sm font-bold py-1.5 rounded-lg transition-colors ${
                  year === y
                    ? "bg-emerald-500 text-black"
                    : "text-gray-500 hover:text-white"
                }`}
              >
                {y}년
              </button>
            ))}
          </div>

          {/* 다음 */}
          <button
            onClick={() => shiftWindow(1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors shrink-0 text-sm"
          >
            ›
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3 opacity-20">📊</div>
            <p className="text-gray-600">팀원 데이터가 없어요</p>
          </div>
        ) : (
          <>
            {/* 헤더 정보 + 관리 버튼 */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-xs text-gray-600">
                {year}년 총 <span className="text-white font-semibold">{totalMatches}</span>경기
                · 팀원 <span className="text-white font-semibold">{stats.length}</span>명
              </p>
              {canManageStats && (
                <button
                  onClick={() => router.push("/stats/manage")}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors"
                >
                  ✏️ 기록 관리
                </button>
              )}
            </div>

            {/* TOP 왕 카드 */}
            {totalMatches > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <TopCard
                  emoji="🥅"
                  label="득점왕"
                  name={topScorer?.goals > 0 ? topScorer.name : undefined}
                  value={topScorer?.goals > 0 ? `${topScorer.goals}골` : undefined}
                  color="emerald"
                />
                <TopCard
                  emoji="🎯"
                  label="도움왕"
                  name={topAssister?.assists > 0 ? topAssister.name : undefined}
                  value={topAssister?.assists > 0 ? `${topAssister.assists}도움` : undefined}
                  color="blue"
                />
                <TopCard
                  emoji="🏃"
                  label="출석왕"
                  name={topAttendance?.attendance_rate > 0 ? topAttendance.name : undefined}
                  value={topAttendance?.attendance_rate > 0 ? `${topAttendance.attendance_rate}%` : undefined}
                  color="amber"
                />
              </div>
            )}

            {/* 정렬 탭 */}
            <div className="flex gap-1.5 mb-4 bg-gray-900 border border-white/5 rounded-xl p-1.5">
              {(["goals", "assists", "attendance_rate", "name"] as SortKey[]).map(key => {
                const labels: Record<SortKey, string> = {
                  goals:           "🥅 골",
                  assists:         "🎯 어시",
                  attendance_rate: "🏃 참석률",
                  name:            "가나다",
                };
                return (
                  <button
                    key={key}
                    onClick={() => setSort(key)}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                      sort === key
                        ? "bg-white/10 text-white"
                        : "text-gray-600 hover:text-gray-400"
                    }`}
                  >
                    {labels[key]}
                  </button>
                );
              })}
            </div>

            {/* 경기 없을 때 */}
            {totalMatches === 0 && (
              <div className="text-center py-10">
                <div className="text-4xl mb-2 opacity-20">📅</div>
                <p className="text-gray-600 text-sm">{year}년 경기 기록이 없어요</p>
              </div>
            )}

            {/* 선수 카드 목록 */}
            <div className="flex flex-col gap-2">
              {sorted.map(p => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  rank={sort !== "name" ? rankMap[p.id] : null}
                  sortKey={sort}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}

/* ────────────────────── 서브 컴포넌트 ────────────────────── */

function TopCard({
  emoji, label, name, value, color,
}: {
  emoji: string; label: string;
  name?: string; value?: string;
  color: "emerald" | "blue" | "amber";
}) {
  const ring = { emerald: "bg-emerald-500/10 border-emerald-500/20", blue: "bg-blue-500/10 border-blue-500/20", amber: "bg-amber-500/10 border-amber-500/20" }[color];
  const text = { emerald: "text-emerald-400", blue: "text-blue-400", amber: "text-amber-400" }[color];
  return (
    <div className={`rounded-2xl border p-3 text-center flex flex-col items-center gap-1 ${ring}`}>
      <span className="text-2xl">{emoji}</span>
      <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      {name ? (
        <>
          <p className="text-sm font-bold text-white leading-tight truncate w-full text-center">{name}</p>
          <p className={`text-xs font-black ${text}`}>{value}</p>
        </>
      ) : (
        <p className="text-xs text-gray-700">기록 없음</p>
      )}
    </div>
  );
}

function PlayerCard({ player, rank, sortKey }: {
  player: PlayerStat; rank: number | null; sortKey: SortKey;
}) {
  const rate     = player.attendance_rate;
  const barColor = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className={`border rounded-2xl px-4 py-3.5 transition-colors ${
      player.is_me
        ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/30"
        : "bg-gray-900 border-white/5 hover:border-white/10"
    }`}>
      <div className="flex items-center gap-3">
        {rank !== null && (
          <span className={`text-sm font-black w-5 shrink-0 text-center ${
            rank === 1 ? "text-yellow-400" : rank === 2 ? "text-gray-400" : rank === 3 ? "text-amber-700" : "text-gray-700"
          }`}>
            {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
          </span>
        )}

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <p className="font-bold text-white text-sm truncate">{player.name}</p>
          {player.is_me && (
            <span className="shrink-0 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">나</span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <StatBadge emoji="🥅" value={player.goals}   unit="골"    active={sortKey === "goals"}   color="emerald" />
          <StatBadge emoji="🎯" value={player.assists} unit="도움" active={sortKey === "assists"} color="blue"    />
        </div>
      </div>

      {/* 참석률 바 */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-[11px] font-semibold ${sortKey === "attendance_rate" ? "text-amber-400" : "text-gray-600"}`}>
            🏃 참석률
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-600">{player.attended}/{player.total_matches}경기</span>
            <span className={`text-xs font-black ${
              player.total_matches === 0 ? "text-gray-700" :
              rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400"
            }`}>
              {player.total_matches === 0 ? "–" : `${rate}%`}
            </span>
          </div>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${rate}%` }} />
        </div>
      </div>
    </div>
  );
}

function StatBadge({ emoji, value, unit, active, color }: {
  emoji: string; value: number; unit: string; active: boolean; color: "emerald" | "blue";
}) {
  const cls = {
    emerald: active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-gray-500 border-white/5",
    blue:    active ? "bg-blue-500/20    text-blue-400    border-blue-500/30"    : "bg-white/5 text-gray-500 border-white/5",
  }[color];
  return (
    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold ${cls}`}>
      <span>{emoji}</span><span>{value}{unit}</span>
    </div>
  );
}
