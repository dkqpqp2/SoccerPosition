"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import { clockOffset, formatRemaining, msUntilExpiry } from "./roomTime";

type OpenRoom = { id: string; expiresAt: string; createdByName: string | null };

/**
 * 홈 화면의 "라운지가 열렸어요" 카드. 열린 방이 있을 때만 보이고, 누르면 라운지로 들어간다.
 * 라운지를 쓸 수 있는 팀에서만 그려야 한다(호출하는 쪽이 판단). 방 상태는 라운지 입구와 같은 /api/lounge/session으로 본다.
 */
export default function LoungeHomeCard() {
  const router = useRouter();
  const [room, setRoom] = useState<OpenRoom | null>(null);
  const [offset, setOffset] = useState(0); // 서버 시각 - 내 시계
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/lounge/session", { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) { setRoom(null); return; }
        const data = await res.json();
        if (!alive) return;
        setOffset(clockOffset(data.serverNow));
        setNow(Date.now());
        setRoom(data.room ?? null);
      } catch {
        // 네트워크가 잠깐 끊겨도 마지막 상태를 그대로 둔다
      }
    }

    load();
    const poll = setInterval(load, 60_000);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!room) return null;
  const remaining = msUntilExpiry(room.expiresAt, offset, now);
  if (remaining <= 0) return null;

  return (
    <button
      onClick={() => router.push("/lounge")}
      className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3 text-left"
    >
      <DoorOpen size={20} className="text-emerald-400 shrink-0" strokeWidth={1.75} />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-emerald-300 text-sm">팀 라운지가 열렸어요</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {room.createdByName ? `${room.createdByName}님이 열었어요 · ` : ""}남은 시간 {formatRemaining(remaining)}
        </p>
      </div>
      <span className="text-emerald-400 text-xs font-bold shrink-0">들어가기 →</span>
    </button>
  );
}
