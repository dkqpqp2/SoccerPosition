"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RulesInfo = { content: string; updatedAt: string | null; updatedByName: string | null };
export type LoungeInfo = {
  balance: number | null; // 못 읽었으면 null (0원으로 잘못 보여 주지 않기 위해)
  rules: RulesInfo | null;
  rulesUnavailable?: boolean;
  canEditRules: boolean;
  demo?: boolean;
};
export type LoungeInfoStatus = "loading" | "ok" | "error";

const REFRESH_AFTER_MS = 30_000; // 이보다 오래된 정보는 창을 다시 열 때 새로 불러온다

/** 라운지 벽에 보여 줄 팀 회비 잔액과 팀 규칙 */
export function useLoungeInfo() {
  const [data, setData] = useState<LoungeInfo | null>(null);
  const [status, setStatus] = useState<LoungeInfoStatus>("loading");
  const loadedAt = useRef(0);
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/lounge/info", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as LoungeInfo;
      if (!alive.current) return;
      setData(json);
      setStatus("ok");
      loadedAt.current = Date.now();
    } catch {
      if (alive.current) setStatus(prev => (prev === "ok" ? prev : "error")); // 이미 보여 주던 정보가 있으면 유지
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

  /** 규칙 저장. 성공하면 null, 실패하면 보여 줄 오류 문구 */
  const saveRules = useCallback(async (content: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/lounge/info", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return typeof json.error === "string" ? json.error : "저장하지 못했어요.";
      if (alive.current) setData(prev => (prev ? { ...prev, rules: json.rules ?? null, rulesUnavailable: false } : prev));
      return null;
    } catch {
      return "네트워크 오류가 났어요. 다시 시도해 주세요.";
    }
  }, []);

  return { data, status, refreshIfStale, saveRules };
}
