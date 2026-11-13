"use client";

import { useEffect, useState } from "react";
import { UserX } from "lucide-react";

interface Blocked { user_id: string; name: string | null }

/** 마이페이지: 내가 차단한 사용자 목록과 차단 해제. 차단한 사람이 없으면 아무것도 보이지 않는다. */
export default function BlockedUsers() {
  const [list, setList] = useState<Blocked[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/blocks")
      .then(r => (r.ok ? r.json() : []))
      .then(data => { if (Array.isArray(data)) setList(data); })
      .catch(() => {});
  }, []);

  async function unblock(userId: string) {
    setBusyId(userId);
    setError("");
    try {
      const res = await fetch(`/api/blocks/${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setList(prev => prev.filter(b => b.user_id !== userId));
    } catch {
      setError("차단을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusyId(null);
    }
  }

  if (list.length === 0) return null;

  return (
    <div className="bg-gray-900 border border-white/5 rounded-2xl p-5">
      <h2 className="font-bold text-white mb-1 text-sm flex items-center gap-2"><UserX size={15} strokeWidth={2} /> 차단한 사용자</h2>
      <p className="text-xs text-gray-500 mb-3">차단한 사용자의 사진과 댓글은 보이지 않아요.</p>
      <ul className="space-y-2">
        {list.map(b => (
          <li key={b.user_id} className="flex items-center justify-between gap-3 bg-gray-800 rounded-xl px-3 py-2.5">
            <span className="text-sm text-gray-200 truncate">{b.name ?? "다른 팀 사용자"}</span>
            <button
              onClick={() => unblock(b.user_id)}
              disabled={busyId === b.user_id}
              className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 disabled:opacity-50 font-bold"
            >
              {busyId === b.user_id ? "처리 중..." : "차단 해제"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </div>
  );
}
