"use client";

import { useState } from "react";
import type { Board, LeaderboardData, LeaderboardStatus } from "./useLeaderboard";

type Tab = "goals" | "assists" | "attendance";

const TABS: { key: Tab; label: string; unit: (v: number) => string }[] = [
  { key: "goals", label: "득점왕", unit: v => `${v}골` },
  { key: "assists", label: "도움왕", unit: v => `${v}도움` },
  { key: "attendance", label: "참석왕", unit: v => `${v}%` },
];

/** 명예의 전당 보드를 탭했을 때 뜨는 순위 창 (각 항목 상위 5명) */
export default function LeaderboardModal({
  data,
  status,
  onClose,
}: {
  data: LeaderboardData | null;
  status: LeaderboardStatus;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("goals");
  const current = TABS.find(t => t.key === tab)!;
  const board: Board | null = data ? data.boards[tab] : null;

  return (
    <div
      className="absolute inset-0 z-50 bg-black/65 flex items-center justify-center px-5"
      // 이 창 위의 터치·휠이 뒤의 3D 카메라 확대/축소로 번지지 않게 막는다
      onPointerDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      <div role="dialog" aria-modal="true" aria-label="명예의 전당" className="bg-gray-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-black text-base">🏆 명예의 전당{data ? ` · ${data.year}` : ""}</h2>
          <button onClick={onClose} aria-label="닫기" className="w-8 h-8 rounded-full bg-white/10 text-white text-sm font-bold">✕</button>
        </div>

        <div className="flex gap-1.5 mb-3">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold ${tab === t.key ? "bg-emerald-500 text-black" : "bg-gray-800 text-gray-300"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-[200px]">
          {status === "loading" && !data && <p className="text-gray-400 text-sm text-center py-16">불러오는 중…</p>}
          {status === "error" && !data && <p className="text-gray-400 text-sm text-center py-16">순위를 불러오지 못했어요</p>}
          {board && board.rows.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-16 leading-relaxed">
              {data && data.totalMatches === 0 ? "올해 등록된 경기가 아직 없어요" : tab === "attendance" ? "후보가 없어요" : "아직 기록이 없어요"}
            </p>
          )}
          {board && board.rows.length > 0 && (
            <ol className="space-y-1.5">
              {board.rows.map((r, i) => {
                // 같은 기록이면 같은 순위(공동 순위): 기록이 같은 첫 사람의 자리 번호를 쓴다
                const rank = board.rows.findIndex(x => x.value === r.value) + 1;
                const first = rank === 1;
                return (
                  <li key={`${r.name}-${i}`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${first ? "bg-emerald-500/15 border border-emerald-500/30" : "bg-gray-800/70"}`}>
                    <span className="w-6 text-center text-sm font-black text-amber-300">{first ? "👑" : rank}</span>
                    <span className="flex-1 min-w-0 text-white text-sm font-bold truncate">
                      {r.jersey_number != null && <span className="text-gray-500 font-medium mr-1.5">#{r.jersey_number}</span>}
                      {r.name}
                    </span>
                    <span className="text-xs text-gray-500">{r.games_played}경기</span>
                    <span className="text-emerald-300 text-sm font-black w-14 text-right">{current.unit(r.value)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {data && (
          <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
            {data.totalMatches > 0
              ? `올해 ${data.totalMatches}경기 중 ${data.minGames}경기 이상(전체의 ${data.minPercent}%) 참석한 팀원만 순위에 올라요.`
              : "경기가 등록되면 순위가 생겨요."}
            {data.demo && " (개발용 예시 데이터)"}
          </p>
        )}
      </div>
    </div>
  );
}
