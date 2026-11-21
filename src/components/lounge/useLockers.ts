"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LockerMember = {
  id: string;
  name: string;
  jersey_number: number | null;
  position_1st: string | null;
  position_2nd: string | null;
  is_me: boolean;
  strengths: string;
  weaknesses: string;
};
export type LockersStatus = "loading" | "ok" | "error";

const REFRESH_AFTER_MS = 30_000;

/** 라운지 락커(팀원 한 명 = 락커 한 칸). 정렬은 서버가 정해 준 순서 그대로 쓴다 */
export function useLockers() {
  const [members, setMembers] = useState<LockerMember[]>([]);
  const [status, setStatus] = useState<LockersStatus>("loading");
  const loadedAt = useRef(0);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lounge/lockers", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as { members?: LockerMember[] };
      if (!alive.current) return;
      setMembers(Array.isArray(json.members) ? json.members : []);
      setStatus("ok");
      loadedAt.current = Date.now();
    } catch {
      if (alive.current) setStatus(prev => (prev === "ok" ? prev : "error"));
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => { alive.current = false; };
  }, [load]);

  const refreshIfStale = useCallback(() => {
    if (Date.now() - loadedAt.current > REFRESH_AFTER_MS) void load();
  }, [load]);

  return { members, status, refreshIfStale };
}
