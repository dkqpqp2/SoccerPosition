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
  games_played: number;
  total_matches: number;
  attendance_rate: number;
}

type SortKey = "goals" | "assists" | "attendance_rate" | "name";

const CURRENT_YEAR = new Date().getFullYear();
const PAGE_SIZE    = 10;

const SORT_LABELS: Record<SortKey, string> = {
  goals:           "🥅 골",
  assists:         "🎯 어시",
  attendance_rate: "🏃 참석률",
  name:            "가나다",
};

export default function StatsPage() {
  const { status } = useSession();
  const router     = useRouter();

  const [stats,     setStats]     = useState<PlayerStat[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [sort,      setSort]      = useState<SortKey>("goals");
  const [year,      setYear]      = useState(String(CURRENT_YEAR));
  const [userRole,  setUserRole]  = useState<string | null>(null);
  const [baseYear,  setBaseYear]  = useState(CURRENT_YEAR);
  const [listPage,  setListPage]  = useState(0);

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
    setListPage(0);
    setLoading(false);
  }

  // "나"가 포함된 페이지로 자동 이동
  useEffect(() => {
    if (!me || !stats.length) return;
    const list = sort === "name" ? fullSorted : fullSorted.slice(3);
    const idx = list.findIndex(p => p.is_me);
    if (idx >= 0) setListPage(Math.floor(idx / PAGE_SIZE));
  }, [stats, sort]);

  function switchYear(y: string) { setYear(y); fetchStats(y); }
  function shiftWindow(delta: number) {
    const nb = baseYear + delta;
    setBaseYear(nb);
    const ny = String(nb);
    setYear(ny);
    fetchStats(ny);
  }

  /* ── 정렬 ── */
  const fullSorted = [...stats].sort((a, b) =>
    sort === "name" ? a.name.localeCompare(b.name) : b[sort] - a[sort]
  );
  const rankMap = Object.fromEntries(fullSorted.map((p, i) => [p.id, i + 1]));

  const me      = stats.find(p => p.is_me);
  const totalMatches = stats[0]?.total_matches ?? 0;

  /* ── TOP 3 (sort !== "name" 일 때만) ── */
  const top3 = sort !== "name" ? fullSorted.slice(0, 3) : [];

  /* ── 전체 순위 목록: "나"도 올바른 순위 위치에 포함 ── */
  const restList = sort === "name" ? fullSorted : fullSorted.slice(3);

  const totalPages  = Math.ceil(restList.length / PAGE_SIZE);
  const pagedList   = restList.slice(listPage * PAGE_SIZE, (listPage + 1) * PAGE_SIZE);

  /* "나"가 있는 페이지로 자동 이동 (sort/stats 변경 시) */
  const myRestIdx = me ? restList.findIndex(p => p.is_me) : -1;

  return (
    <AppLayout title="팀 통계">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* ── 연도 탭 ── */}
        <div className="flex items-center gap-2 mb-5">
          <button onClick={() => shiftWindow(-1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors shrink-0 text-sm">‹</button>
          <div className="flex gap-1.5 flex-1 bg-gray-900 border border-white/5 rounded-xl p-1.5">
            {windowYears.map(y => (
              <button key={y} onClick={() => switchYear(y)}
                className={`flex-1 text-sm font-bold py-1.5 rounded-lg transition-colors ${
                  year === y ? "bg-emerald-500 text-black" : "text-gray-500 hover:text-white"
                }`}>{y}년</button>
            ))}
          </div>
          <button onClick={() => shiftWindow(1)}
            className="w-8 h-8 flex items-center justify-center bg-gray-900 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-xl transition-colors shrink-0 text-sm">›</button>
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
            {/* ── 정보바 + 관리 버튼 ── */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-gray-600">
                {year}년 총 <span className="text-white font-semibold">{totalMatches}</span>경기
                · 팀원 <span className="text-white font-semibold">{stats.length}</span>명
              </p>
              {canManageStats && (
                <button onClick={() => router.push("/stats/manage")}
                  className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors">
                  ✏️ 기록 관리
                </button>
              )}
            </div>

            {/* ── 정렬 탭 ── */}
            <div className="flex gap-1.5 mb-5 bg-gray-900 border border-white/5 rounded-xl p-1.5">
              {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                <button key={key} onClick={() => { setSort(key); setListPage(0); }}
                  className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
                    sort === key ? "bg-white/10 text-white" : "text-gray-600 hover:text-gray-400"
                  }`}>
                  {SORT_LABELS[key]}
                </button>
              ))}
            </div>

            {/* ── 나 카드 ── */}
            {me && (
              <div className="mb-5">
                <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">내 기록</p>
                <MyCard player={me} rank={sort !== "name" ? rankMap[me.id] : null} sortKey={sort} totalPlayers={stats.length} />
              </div>
            )}

            {/* ── TOP 3 포디엄 ── */}
            {sort !== "name" && top3.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">TOP 3</p>
                <div className="grid grid-cols-3 gap-2">
                  {top3.map((p, i) => (
                    <PodiumCard key={p.id} player={p} rank={i + 1} sortKey={sort} />
                  ))}
                </div>
              </div>
            )}

            {/* ── 나머지 컴팩트 목록 ── */}
            {restList.length > 0 && (
              <div>
                <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">
                  {sort !== "name" ? "전체 순위" : "팀원 목록"}
                </p>
                <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
                  <div className="divide-y divide-white/5">
                    {pagedList.map(p => (
                      <CompactRow key={p.id} player={p} rank={sort !== "name" ? rankMap[p.id] : null} sortKey={sort} />
                    ))}
                  </div>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
                      <button onClick={() => setListPage(p => Math.max(0, p - 1))} disabled={listPage === 0}
                        className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                        ‹ 이전
                      </button>
                      <span className="text-xs text-gray-600">{listPage + 1} / {totalPages}</span>
                      <button onClick={() => setListPage(p => Math.min(totalPages - 1, p + 1))} disabled={listPage === totalPages - 1}
                        className="text-sm px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                        다음 ›
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

/* ═══════════════════════════════════════
   내 카드 (상단 고정, 풀 사이즈)
═══════════════════════════════════════ */
function MyCard({ player, rank, sortKey, totalPlayers }: {
  player: PlayerStat; rank: number | null; sortKey: SortKey; totalPlayers: number;
}) {
  const rate     = player.attendance_rate;
  const barColor = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-red-500";
  const rankMedal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div className="bg-emerald-500/5 border-2 border-emerald-500/30 rounded-2xl px-4 py-4">
      <div className="flex items-center gap-3 mb-3">
        {/* 순위 */}
        {rank !== null && (
          <div className="shrink-0 text-center w-8">
            {rankMedal ? (
              <span className="text-2xl">{rankMedal}</span>
            ) : (
              <span className="text-lg font-black text-gray-500">{rank}</span>
            )}
          </div>
        )}

        {/* 이름 + 나 뱃지 */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <p className="font-black text-white text-base truncate">{player.name}</p>
          <span className="shrink-0 text-[10px] font-bold bg-emerald-500 text-black px-2 py-0.5 rounded-full">나</span>
          {rank !== null && (
            <span className="text-[11px] text-gray-500 shrink-0">{rank}/{totalPlayers}위</span>
          )}
        </div>

        {/* 스탯 뱃지 */}
        <div className="flex items-center gap-1.5 shrink-0">
          <StatBadge emoji="🥅" value={player.goals}   unit="골"  active={sortKey === "goals"}   color="emerald" size="lg" />
          <StatBadge emoji="🎯" value={player.assists} unit="도움" active={sortKey === "assists"} color="blue"    size="lg" />
        </div>
      </div>

      {/* 참석률 바 */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-semibold ${sortKey === "attendance_rate" ? "text-amber-400" : "text-gray-500"}`}>🏃 참석률</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-gray-600">{player.games_played}/{player.total_matches}경기</span>
            <span className={`text-sm font-black ${
              player.total_matches === 0 ? "text-gray-700" :
              rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400"
            }`}>
              {player.total_matches === 0 ? "–" : `${rate}%`}
            </span>
          </div>
        </div>
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${rate}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   포디엄 카드 (TOP 3)
═══════════════════════════════════════ */
const PODIUM_STYLES = [
  { border: "border-yellow-400/40",  bg: "bg-yellow-400/5",  medal: "🥇", nameColor: "text-yellow-300", label: "1위" },
  { border: "border-gray-400/40",    bg: "bg-gray-400/5",    medal: "🥈", nameColor: "text-gray-300",   label: "2위" },
  { border: "border-amber-700/40",   bg: "bg-amber-700/5",   medal: "🥉", nameColor: "text-amber-600",  label: "3위" },
];

function PodiumCard({ player, rank, sortKey }: {
  player: PlayerStat; rank: number; sortKey: SortKey;
}) {
  const s    = PODIUM_STYLES[rank - 1];
  const rate = player.attendance_rate;

  const mainValue = sortKey === "goals"           ? `${player.goals}골`
                  : sortKey === "assists"         ? `${player.assists}도움`
                  : sortKey === "attendance_rate" ? `${rate}%`
                  : "";

  const barColor = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-red-500";

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-3 flex flex-col items-center gap-1.5`}>
      <span className="text-2xl">{s.medal}</span>
      <p className={`text-xs font-black truncate w-full text-center ${s.nameColor}`}>
        {player.name}
        {player.is_me && <span className="ml-1 text-[9px] bg-emerald-500/30 text-emerald-400 px-1 py-0.5 rounded-full">나</span>}
      </p>
      {mainValue && (
        <p className="text-base font-black text-white">{mainValue}</p>
      )}
      {/* 참석률 미니 바 */}
      <div className="w-full mt-0.5">
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate}%` }} />
        </div>
        <p className="text-[10px] text-gray-600 text-center mt-0.5">{player.games_played}/{player.total_matches}경기</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   컴팩트 행 (4위 이하)
═══════════════════════════════════════ */
function CompactRow({ player, rank, sortKey }: {
  player: PlayerStat; rank: number | null; sortKey: SortKey;
}) {
  const rate     = player.attendance_rate;
  const barColor = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-400" : "bg-red-500";
  const isMe     = player.is_me;

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
      isMe ? "bg-emerald-500/8 border-l-2 border-emerald-500" : "hover:bg-white/3"
    }`}>
      {/* 순위 */}
      <span className={`text-xs w-5 text-center shrink-0 font-bold ${isMe ? "text-emerald-400" : "text-gray-600"}`}>
        {rank ?? "·"}
      </span>

      {/* 이름 + 나 뱃지 */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <p className={`text-sm font-semibold truncate ${isMe ? "text-emerald-300" : "text-white"}`}>{player.name}</p>
        {isMe && <span className="shrink-0 text-[10px] font-bold bg-emerald-500 text-black px-1.5 py-0.5 rounded-full">나</span>}
      </div>

      {/* 스탯 */}
      <div className="flex items-center gap-1.5 shrink-0">
        <StatBadge emoji="🥅" value={player.goals}   unit="골"  active={sortKey === "goals"}   color="emerald" size="sm" />
        <StatBadge emoji="🎯" value={player.assists} unit="도움" active={sortKey === "assists"} color="blue"    size="sm" />
      </div>

      {/* 참석률 */}
      <div className="w-16 shrink-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={`text-[10px] font-bold ${
            player.total_matches === 0 ? "text-gray-700" :
            rate >= 80 ? "text-emerald-400" : rate >= 50 ? "text-amber-400" : "text-red-400"
          }`}>
            {player.total_matches === 0 ? "–" : `${rate}%`}
          </span>
        </div>
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${rate}%` }} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   공통 스탯 뱃지
═══════════════════════════════════════ */
function StatBadge({ emoji, value, unit, active, color, size = "sm" }: {
  emoji: string; value: number; unit: string;
  active: boolean; color: "emerald" | "blue";
  size?: "sm" | "lg";
}) {
  const cls = {
    emerald: active ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-white/5 text-gray-500 border-white/5",
    blue:    active ? "bg-blue-500/20    text-blue-400    border-blue-500/30"    : "bg-white/5 text-gray-500 border-white/5",
  }[color];
  return (
    <div className={`flex items-center gap-0.5 border rounded-lg font-bold ${cls} ${
      size === "lg" ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[11px]"
    }`}>
      <span>{emoji}</span><span>{value}{unit}</span>
    </div>
  );
}
