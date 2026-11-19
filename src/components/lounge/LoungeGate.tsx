"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { clockOffset, msUntilExpiry } from "./roomTime";

// three.js는 브라우저에서만 돌고 용량도 커서, 방에 들어갈 때만 불러온다 (로비·종료 화면은 가볍게 열린다)
const LoungeScene = dynamic(() => import("./LoungeScene"), {
  ssr: false,
  loading: () => <Screen><p className="text-gray-400 text-sm">라운지 불러오는 중…</p></Screen>,
});

type SessionData = {
  serverNow: string;
  canManage: boolean;
  me: { memberId: string | null; name: string };
  room: { id: string; expiresAt: string; createdByName: string | null } | null;
  channel: string | null;
};
type Ended = "closed" | "expired" | null;

const POLL_IN_ROOM_MS = 20_000; // 방 안에 있는 동안 방이 아직 열려 있는지 서버에 확인하는 간격
const POLL_LOBBY_MS = 10_000; // 로비에서 방이 열렸는지 확인하는 간격(열리면 자동으로 입장)

function Screen({ children }: { children: ReactNode }) {
  return <div className="fixed inset-0 bg-gray-950 text-white flex flex-col items-center justify-center px-6 text-center gap-4">{children}</div>;
}

const primaryBtn = "w-full max-w-xs bg-emerald-500 hover:bg-emerald-400 text-black font-black py-3 rounded-xl text-sm disabled:opacity-50";
const ghostLink = "text-gray-400 text-sm underline underline-offset-4";

/**
 * 라운지의 입구: 우리 팀에 열린 방이 있는지 서버에 물어 보고 화면을 정한다.
 * - 열린 방 있음 → 방(3D)에 입장 / 없음 → 로비(관리자급은 "라운지 열기", 팀원은 열리길 기다림) / 닫힘·만료 → 종료 안내
 * 방은 서버(DB)에 남는 상태라서, 방을 연 관리자가 나가도 그대로 열려 있다.
 */
export default function LoungeGate() {
  const [data, setData] = useState<SessionData | null>(null);
  const [offset, setOffset] = useState(0); // 서버 시각 − 내 시각 (남은 시간 계산용)
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ended, setEnded] = useState<Ended>(null);
  const [busy, setBusy] = useState(false);
  const roomIdRef = useRef<string | null>(null); // 지금 들어가 있는 방 id
  const aliveRef = useRef(true);

  const inRoom = !!data?.room && !!data.channel && !ended;
  useEffect(() => {
    roomIdRef.current = inRoom ? data!.room!.id : null;
  }, [inRoom, data]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/lounge/session", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as SessionData;
      if (!aliveRef.current) return;
      setOffset(clockOffset(json.serverNow));
      setData(json);
      setLoadError(null);
      // 들어가 있던 방이 닫혔거나 다른 방으로 바뀌었으면 종료 안내
      const current = roomIdRef.current;
      if (current && json.room?.id !== current) setEnded("closed");
    } catch {
      if (aliveRef.current) setLoadError("라운지 정보를 불러오지 못했어요");
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  // 주기적으로 서버에 확인: 방 안에서는 닫혔는지, 로비에서는 열렸는지. 화면이 다시 보일 때도 바로 확인한다.
  useEffect(() => {
    if (ended) return;
    const t = setInterval(() => void load(), inRoom ? POLL_IN_ROOM_MS : POLL_LOBBY_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [inRoom, ended, load]);

  // 24시간이 지나면 서버 확인을 기다리지 않고 바로 종료 안내
  const expiresAt = data?.room?.expiresAt;
  useEffect(() => {
    if (!inRoom || !expiresAt) return;
    const check = () => {
      if (msUntilExpiry(expiresAt, offset) <= 0) setEnded("expired");
    };
    check();
    const t = setInterval(check, 5_000);
    return () => clearInterval(t);
  }, [inRoom, expiresAt, offset]);

  async function openRoom() {
    setBusy(true);
    try {
      // 개발 전용: 주소에 ?ttlSec=20 을 붙이면 20초 뒤 만료되는 방을 열어 만료 흐름을 시험할 수 있다
      const ttl = process.env.NODE_ENV === "development" ? new URLSearchParams(window.location.search).get("ttlSec") : null;
      const res = await fetch(`/api/lounge/room${ttl ? `?ttlSec=${encodeURIComponent(ttl)}` : ""}`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as SessionData;
      setOffset(clockOffset(json.serverNow));
      setData(json);
      setEnded(null);
      setLoadError(null);
    } catch {
      setLoadError("방을 열지 못했어요. 잠시 뒤 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    setEnded(null);
    setLoadError(null);
    await load();
  }

  // 방 닫기(관리자급): 성공하면 true
  const closeRoom = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/lounge/room", { method: "DELETE" });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  if (!data) {
    return (
      <Screen>
        {loadError ? (
          <>
            <p className="text-gray-300 text-sm">{loadError}</p>
            <button onClick={() => void recheck()} className={primaryBtn}>다시 시도</button>
            <Link href="/dashboard" className={ghostLink}>← 나가기</Link>
          </>
        ) : (
          <p className="text-gray-400 text-sm">라운지 확인하는 중…</p>
        )}
      </Screen>
    );
  }

  if (ended) {
    return (
      <Screen>
        <div className="text-5xl">🏟️</div>
        <h1 className="text-xl font-black">라운지가 종료됐어요</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          {ended === "expired" ? "열린 지 24시간이 지나서 자동으로 종료됐어요." : "관리자가 라운지를 닫았어요."}
          <br />
          나눈 대화는 저장되지 않아서 모두 사라졌어요.
        </p>
        {data.canManage ? (
          <button onClick={() => { setEnded(null); void openRoom(); }} disabled={busy} className={primaryBtn}>{busy ? "여는 중…" : "새 라운지 열기"}</button>
        ) : (
          <button onClick={() => void recheck()} className={primaryBtn}>다시 확인</button>
        )}
        <Link href="/dashboard" className={ghostLink}>← 나가기</Link>
      </Screen>
    );
  }

  if (data.room && data.channel) {
    return (
      <LoungeScene
        key={data.room.id}
        canManage={data.canManage}
        meName={data.me.name}
        channelName={data.channel}
        expiresAt={data.room.expiresAt}
        clockOffset={offset}
        onRequestClose={closeRoom}
        onClosed={() => setEnded("closed")}
        onRoomSignal={() => void load()}
      />
    );
  }

  // 열린 방이 없는 로비
  return (
    <Screen>
      <div className="text-5xl">🏟️</div>
      <h1 className="text-xl font-black">팀 라운지</h1>
      {data.canManage ? (
        <>
          <p className="text-gray-400 text-sm leading-relaxed">
            지금 열린 라운지가 없어요.
            <br />
            열면 24시간 동안 팀원 누구나 들어올 수 있어요.
            <br />
            내가 나가도 방은 그대로 열려 있고, 언제든 닫을 수 있어요.
          </p>
          <button onClick={() => void openRoom()} disabled={busy} className={primaryBtn}>{busy ? "여는 중…" : "라운지 열기 (24시간)"}</button>
        </>
      ) : (
        <p className="text-gray-400 text-sm leading-relaxed">
          아직 열린 라운지가 없어요.
          <br />
          관리자가 열면 자동으로 들어갈 수 있어요.
        </p>
      )}
      {loadError && <p className="text-red-400 text-xs">{loadError}</p>}
      <Link href="/dashboard" className={ghostLink}>← 나가기</Link>
    </Screen>
  );
}
