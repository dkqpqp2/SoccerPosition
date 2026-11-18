"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
// Realtime(Presence)만 쓰고 DB 테이블은 건드리지 않는다 — 방 채널 이름은 /api/lounge/session이 서버에서 계산해 내려준다.
import { supabaseClient } from "@/lib/supabaseClient";
import { containsProfanity } from "@/lib/profanity";

export const MAX_CHAT_LENGTH = 80;
const CHAT_MIN_INTERVAL_MS = 1000; // 연속 전송 최소 간격

export type PresenceState = {
  name: string;
  color: string;
  x: number; // 마지막으로 탭했을 때의 출발 위치
  z: number;
  tx: number | null; // 걸어가는 목표 지점(없으면 서 있음)
  tz: number | null;
  seq: number; // 탭할 때마다 1씩 증가 — 받는 쪽이 "새 이동"을 알아채는 용도
  beat: number; // 15초마다 1씩 증가하는 "살아 있어요" 신호 — 갑자기 꺼진 사람을 받는 쪽이 걸러내는 용도
  // 채팅: 보낸 사람 본인의 접속 상태에 실어 보낸다 → Supabase가 상태는 그 사람의 키로만 쓰게 막아 주므로 다른 사람 이름으로 위조할 수 없다.
  sayId: number; // 메시지를 보낼 때마다 1씩 증가 (받는 쪽이 새 메시지를 알아채는 용도)
  sayText: string;
};

export type ChatMessage = { id: string; key: string; name: string; text: string; mine: boolean; at: number };
export type SayResult = "ok" | "empty" | "profanity" | "rate" | "offline";

export type OtherPlayer = PresenceState & { key: string };
export type RoomStatus = "connecting" | "online" | "error";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HEARTBEAT_MS = 15_000; // 내 "살아 있어요" 신호 간격
const STALE_MS = 45_000; // 이만큼 신호가 없으면 목록에서 뺀다 (탭을 갑자기 닫은 사람 등)
const PRUNE_CHECK_MS = 5_000;

// 다른 사람이 보낸 값은 믿지 않는다: 숫자·색·이름을 검사하고 범위를 맞춘다
function sanitize(raw: unknown, clamp: (x: number, z: number) => { x: number; z: number }): PresenceState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const x = num(r.x);
  const z = num(r.z);
  if (x === null || z === null) return null;
  const start = clamp(x, z);
  const tx = num(r.tx);
  const tz = num(r.tz);
  const target = tx !== null && tz !== null ? clamp(tx, tz) : null;
  return {
    name: typeof r.name === "string" ? r.name.slice(0, 12) : "팀원",
    color: typeof r.color === "string" && HEX_COLOR.test(r.color) ? r.color : "#f8fafc",
    x: start.x,
    z: start.z,
    tx: target ? target.x : null,
    tz: target ? target.z : null,
    seq: num(r.seq) ?? 0,
    beat: num(r.beat) ?? 0,
    sayId: num(r.sayId) ?? 0,
    sayText: typeof r.sayText === "string" ? r.sayText.slice(0, MAX_CHAT_LENGTH) : "",
  };
}

/**
 * 라운지 방에 접속해서 같은 방 사람들의 상태를 받고, 내 상태를 알린다.
 * 위치는 계속 보내지 않고 "탭할 때"만 보낸다(출발점 + 목표 지점). 받는 쪽이 같은 속도로 걸어가는 모습을 그린다.
 */
export function useLoungeRoom(opts: {
  initial: { color: string; x: number; z: number };
  clamp: (x: number, z: number) => { x: number; z: number };
  onChat?: (m: ChatMessage) => void; // 새 채팅(내 것 포함)이 생길 때마다 호출
}) {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const [myName, setMyName] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myKey = useRef<string>("");
  const stateRef = useRef<PresenceState | null>(null); // 내 최신 상태
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);
  const clampRef = useRef(opts.clamp);
  const initialRef = useRef(opts.initial);
  // 다른 사람마다 "마지막으로 변화(이동·색·살아 있음 신호)를 본 시각"을 내 시계로 기록한다 (남의 시계는 믿지 않는다)
  const seenRef = useRef(new Map<string, { sig: string; at: number }>());
  const allOthersRef = useRef<OtherPlayer[]>([]);
  const seenSayRef = useRef(new Map<string, number>()); // 사람별로 이미 본 마지막 메시지 번호
  const lastSayAt = useRef(0);
  const onChatRef = useRef(opts.onChat);
  onChatRef.current = opts.onChat;

  // 너무 자주 보내지 않게 모아서 보낸다(마지막 상태는 반드시 전송)
  const flush = useCallback(() => {
    const ch = channelRef.current;
    const state = stateRef.current;
    if (!ch || !state || !readyRef.current) return;
    const wait = 100 - (Date.now() - lastSent.current);
    const send = () => {
      timerRef.current = null;
      lastSent.current = Date.now();
      if (channelRef.current && stateRef.current) void channelRef.current.track(stateRef.current);
    };
    if (timerRef.current) return; // 이미 예약돼 있으면 그때 최신 상태가 나간다
    if (wait <= 0) send();
    else timerRef.current = setTimeout(send, wait);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    myKey.current = crypto.randomUUID();
    const seen = seenRef.current;
    const seenSay = seenSayRef.current;

    // 신호가 끊긴 지 오래된 사람은 빼고 화면용 목록을 만든다
    const publish = () => {
      const now = Date.now();
      setOthers(allOthersRef.current.filter(o => now - (seen.get(o.key)?.at ?? now) < STALE_MS));
    };
    const pruneTimer = setInterval(publish, PRUNE_CHECK_MS);

    // 내 "살아 있어요" 신호: 상태는 그대로 두고 beat만 올려서 다시 알린다
    const beatTimer = setInterval(() => {
      const state = stateRef.current;
      if (!state || !readyRef.current || !channelRef.current) return;
      stateRef.current = { ...state, beat: state.beat + 1 };
      lastSent.current = Date.now();
      void channelRef.current.track(stateRef.current);
    }, HEARTBEAT_MS);

    // 화면을 떠날 때(탭 닫기·앱 전환) 바로 퇴장을 알린다. 이게 안 먹는 경우는 위의 45초 규칙이 정리한다.
    const onPageHide = () => { void channelRef.current?.untrack(); };
    window.addEventListener("pagehide", onPageHide);

    (async () => {
      try {
        const res = await fetch("/api/lounge/session");
        if (!res.ok) throw new Error(`session ${res.status}`);
        const { channel: channelName, me } = (await res.json()) as { channel: string; me: { name: string } };
        if (cancelled) return;
        setMyName(me.name);

        const init = initialRef.current;
        stateRef.current = { name: me.name, color: init.color, x: init.x, z: init.z, tx: null, tz: null, seq: 0, beat: 0, sayId: 0, sayText: "" };

        channel = supabaseClient.channel(channelName, { config: { presence: { key: myKey.current } } });
        channelRef.current = channel;

        channel.on("presence", { event: "sync" }, () => {
          const raw = channel!.presenceState<PresenceState>();
          const list: OtherPlayer[] = [];
          const now = Date.now();
          for (const [key, metas] of Object.entries(raw)) {
            if (key === myKey.current) continue;
            const meta = metas[metas.length - 1];
            const clean = sanitize(meta, clampRef.current);
            if (!clean) continue;
            // 이동·색·살아 있음 신호 중 하나라도 달라졌으면 "방금 움직임이 있었다"고 기록
            const sig = `${clean.seq}:${clean.beat}:${clean.color}`;
            if (seen.get(key)?.sig !== sig) seen.set(key, { sig, at: now });

            // 새 채팅 감지: 처음 본 사람의 마지막 메시지는 "예전 것"일 수 있어서 보여주지 않고 번호만 기억한다
            const prevSay = seenSay.get(key);
            if (prevSay === undefined) {
              seenSay.set(key, clean.sayId);
            } else if (clean.sayId > prevSay) {
              seenSay.set(key, clean.sayId);
              // 받는 쪽에서도 한 번 더 거른다 (수정된 앱이 필터를 건너뛰고 보내도 화면에는 안 나온다)
              if (clean.sayText && !containsProfanity(clean.sayText)) {
                onChatRef.current?.({ id: `${key}:${clean.sayId}`, key, name: clean.name, text: clean.sayText, mine: false, at: now });
              }
            }
            list.push({ ...clean, key });
          }
          for (const key of [...seen.keys()]) if (!list.some(o => o.key === key)) seen.delete(key);
          for (const key of [...seenSay.keys()]) if (!list.some(o => o.key === key)) seenSay.delete(key);
          allOthersRef.current = list;
          publish();
        });

        channel.subscribe(async (s) => {
          if (cancelled) return;
          if (s === "SUBSCRIBED") {
            readyRef.current = true;
            setStatus("online");
            lastSent.current = Date.now();
            if (stateRef.current) await channel!.track(stateRef.current);
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            readyRef.current = false;
            setStatus("error");
          } else if (s === "CLOSED") {
            readyRef.current = false;
          }
        });
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      clearInterval(pruneTimer);
      clearInterval(beatTimer);
      window.removeEventListener("pagehide", onPageHide);
      seen.clear();
      seenSay.clear();
      allOthersRef.current = [];
      readyRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (channel) void supabaseClient.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  /** 내가 바닥을 탭했을 때: 지금 위치에서 목표 지점으로 걸어간다고 알린다 */
  const announceMove = useCallback((from: { x: number; z: number }, to: { x: number; z: number }) => {
    const prev = stateRef.current;
    if (!prev) return;
    stateRef.current = { ...prev, x: from.x, z: from.z, tx: to.x, tz: to.z, seq: prev.seq + 1 };
    flush();
  }, [flush]);

  /** 공 색을 바꿨을 때 */
  const announceColor = useCallback((color: string) => {
    const prev = stateRef.current;
    if (!prev) {
      initialRef.current = { ...initialRef.current, color };
      return;
    }
    stateRef.current = { ...prev, color };
    flush();
  }, [flush]);

  /** 채팅 보내기. 비속어·너무 잦은 전송은 막고 이유를 돌려준다 */
  const say = useCallback((raw: string): SayResult => {
    const text = raw.trim().slice(0, MAX_CHAT_LENGTH);
    const prev = stateRef.current;
    if (!text) return "empty";
    if (!prev || !readyRef.current) return "offline";
    if (containsProfanity(text)) return "profanity";
    const now = Date.now();
    if (now - lastSayAt.current < CHAT_MIN_INTERVAL_MS) return "rate";
    lastSayAt.current = now;
    stateRef.current = { ...prev, sayId: prev.sayId + 1, sayText: text };
    flush();
    onChatRef.current?.({ id: `me:${prev.sayId + 1}`, key: myKey.current, name: prev.name, text, mine: true, at: now });
    return "ok";
  }, [flush]);

  return { status, others, myName, announceMove, announceColor, say };
}
