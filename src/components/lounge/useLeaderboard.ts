"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type BoardRow = { name: string; jersey_number: number | null; value: number; games_played: number };
export type Board = { rows: BoardRow[]; tied: number };
export type LeaderboardData = {
  year: number;
  totalMatches: number;
  minGames: number;
  minPercent: number;
  boards: { goals: Board; assists: Board; attendance: Board };
  demo?: boolean;
};
export type LeaderboardStatus = "loading" | "ok" | "error";

const REFRESH_AFTER_MS = 60_000; // 이보다 오래된 순위는 다시 열 때 새로 불러온다

/** 라운지 벽 "명예의 전당"에 쓸 득점왕·도움왕·참석왕 순위 */
export function useLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [status, setStatus] = useState<LeaderboardStatus>("loading");
  const loadedAt = useRef(0);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lounge/leaderboard");
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as LeaderboardData;
      if (!alive.current) return;
      setData(json);
      setStatus("ok");
      loadedAt.current = Date.now();
    } catch {
      if (alive.current) setStatus(prev => (prev === "ok" ? prev : "error")); // 이미 보여 주던 순위가 있으면 유지
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  /** 순위 창을 열 때: 오래됐으면 새로 불러온다 */
  const refreshIfStale = useCallback(() => {
    if (Date.now() - loadedAt.current > REFRESH_AFTER_MS) void load();
  }, [load]);

  return { data, status, refreshIfStale };
}
