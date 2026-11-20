"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen } from "lucide-react";
import { clockOffset, formatRemaining, msUntilExpiry } from "./roomTime";

type OpenRoom = { id: string; expiresAt: string; createdByName: string | null };

/**
 * 홈 화면의 팀 라운지 카드. 방이 열려 있으면 "들어가기", 없으면 "현재 열린 라운지가 없어요"를 보여 준다.
 * 라운지를 쓸 수 있는 팀에서만 그려야 한다(호출하는 쪽이 판단). 방 상태는 라운지 입구와 같은 /api/lounge/session으로 본다.
 * 처음 읽기 전과 읽기 실패(서버 오류 등) 때는 아무것도 그리지 않는다 — "없어요"라고 잘못 알리지 않기 위해.
 */
export default function LoungeHomeCard() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [room, setRoom] = useState<OpenRoom | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [offset, setOffset] = useState(0); // 서버 시각 - 내 시계
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await fetch("/api/lounge/session", { cache: "no-store" });
        if (!alive) return;
        if (!res.ok) { setLoaded(false); return; }
        const data = await res.json();
        if (!alive) return;
        setOffset(clockOffset(data.serverNow));
        setNow(Date.now());
        setCanManage(!!data.canManage);
        setRoom(data.room ?? null);
        setLoaded(true);
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

  if (!loaded) return null;

  const remaining = room ? msUntilExpiry(room.expiresAt, offset, now) : 0;

  // 열린 방이 있다 → 바로 들어가는 카드
  if (room && remaining > 0) {
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

  // 열린 방이 없다 → 안내 카드 (관리자에게는 열러 가는 버튼도)
  return (
    <div className="bg-gray-900 rounded-lg border border-white/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <DoorOpen size={15} className="text-gray-400" />
        <p className="text-sm font-bold text-white">팀 라운지</p>
      </div>
      <div className="flex flex-col items-center gap-2 py-3">
        <DoorOpen size={30} strokeWidth={1.5} className="opacity-30" />
        <p className="text-xs text-gray-500 font-medium">현재 열린 라운지가 없어요</p>
        <p className="text-[11px] text-gray-600 leading-relaxed text-center break-keep">
          {canManage ? "라운지를 열면 팀원들이 여기서 바로 들어올 수 있어요" : "관리자가 라운지를 열면 여기서 바로 들어갈 수 있어요"}
        </p>
        {canManage && (
          <button
            onClick={() => router.push("/lounge")}
            className="mt-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold border border-emerald-500/30 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors"
          >
            라운지 열러 가기 →
          </button>
        )}
      </div>
    </div>
  );
}
