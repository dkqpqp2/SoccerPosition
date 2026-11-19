"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
// Realtime(Presence)만 쓰고 DB 테이블은 건드리지 않는다 — 방 채널 이름은 /api/lounge/session이 서버에서 계산해 내려준다.
import { supabaseClient } from "@/lib/supabaseClient";
import { containsProfanity } from "@/lib/profanity";
import { collectNewSays, mergeOthers, type Say } from "./presenceList";
import { isValidSeat } from "./loungeConstants";
import { compactBoard, sanitizeBoard, type BoardSnapshot } from "@/lib/tacticsBoard";

export const MAX_CHAT_LENGTH = 80;
const CHAT_MIN_INTERVAL_MS = 1000; // 연속 전송 최소 간격
const MAX_SAYS_CARRIED = 3; // 접속 상태에 함께 싣는 최근 메시지 수

export type PresenceState = {
  name: string;
  color: string;
  x: number; // 마지막으로 탭했을 때의 출발 위치
  z: number;
  tx: number | null; // 걸어가는 목표 지점(없으면 서 있음)
  tz: number | null;
  seq: number; // 탭할 때마다 1씩 증가 — 받는 쪽이 "새 이동"을 알아채는 용도
  seat: number | null; // 앉은(앉으러 가는) 벤치 자리 번호. 바닥을 탭해서 일어나면 null
  beat: number; // 15초마다 1씩 증가하는 "살아 있어요" 신호 — 갑자기 꺼진 사람을 받는 쪽이 걸러내는 용도
  // 채팅: 보낸 사람 본인의 접속 상태에 실어 보낸다 → Supabase가 상태는 그 사람의 키로만 쓰게 막아 주므로 다른 사람 이름으로 위조할 수 없다.
  sayId: number; // 메시지를 보낼 때마다 1씩 증가 (받는 쪽이 새 메시지를 알아채는 용도)
  says: Say[]; // 최근에 보낸 메시지 몇 개(오래된 것부터). 하나만 싣으면 전송이 합쳐질 때 앞 메시지가 사라진다
  // 전술 설명 중이면 지금 보여 주는 전술판. 이것도 내 접속 상태에 실어서, 나중에 들어온 사람도 접속과 동시에 현재 판을 받는다.
  tac: { v: number; board: BoardSnapshot } | null; // v: 판이 바뀔 때마다 1씩 증가
};

/** 지금 전술을 설명 중인 사람 */
export type Presenter = { key: string; name: string; v: number; board: BoardSnapshot };

export type ChatMessage = { id: string; key: string; name: string; text: string; mine: boolean; at: number };
export type SayResult = "ok" | "empty" | "profanity" | "rate" | "offline";

// 전술판은 크기가 커서 캐릭터 목록(OtherPlayer)에는 넣지 않는다 — 판이 바뀔 때마다 30명 캐릭터가 다시 계산되지 않도록 Presenter로 따로 넘긴다.
export type OtherPlayer = Omit<PresenceState, "tac"> & { key: string };
export type RoomStatus = "connecting" | "online" | "error";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const HEARTBEAT_MS = 15_000; // 내 "살아 있어요" 신호 간격
const STALE_MS = 45_000; // 이만큼 신호가 없으면 목록에서 뺀다 (탭을 갑자기 닫은 사람 등)
const PRUNE_CHECK_MS = 5_000;
const TAC_MIN_GAP_MS = 200; // 전술판 변경 전송 최소 간격 (판 하나가 몇 KB라 위치 전송보다 덜 자주 보낸다)
const MAX_RETRIES = 6; // 이만큼 연달아 실패하면 화면에 "연결 실패"를 보여 준다(그 뒤에도 계속 시도한다)

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
    seat: isValidSeat(r.seat) ? r.seat : null,
    beat: num(r.beat) ?? 0,
    sayId: num(r.sayId) ?? 0,
    says: Array.isArray(r.says)
      ? r.says
          .slice(-MAX_SAYS_CARRIED)
          .map((s: unknown): Say | null => {
            const o = s as Record<string, unknown> | null;
            const id = o ? num(o.id) : null;
            return id !== null && typeof o?.text === "string" ? { id, text: o.text.slice(0, MAX_CHAT_LENGTH) } : null;
          })
          .filter((s): s is Say => s !== null)
      : [],
    tac: (() => {
      const board = sanitizeBoard((r.tac as Record<string, unknown> | null | undefined)?.board);
      const v = num((r.tac as Record<string, unknown> | null | undefined)?.v);
      return board && v !== null ? { v, board } : null;
    })(),
  };
}

/**
 * 라운지 방에 접속해서 같은 방 사람들의 상태를 받고, 내 상태를 알린다.
 * 위치는 계속 보내지 않고 "탭할 때"만 보낸다(출발점 + 목표 지점). 받는 쪽이 같은 속도로 걸어가는 모습을 그린다.
 */
export function useLoungeRoom(opts: {
  channelName: string; // 방 채널 이름(서버가 방마다 계산해서 알려 준 것)
  meName: string; // 방에서 보일 내 이름
  initial: { color: string; x: number; z: number };
  clamp: (x: number, z: number) => { x: number; z: number };
  onChat?: (m: ChatMessage) => void; // 새 채팅(내 것 포함)이 생길 때마다 호출
  onRoomSignal?: () => void; // 누가 "방을 닫았다"고 알렸을 때 호출 (서버에 방 상태를 다시 확인하는 용도)
}) {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [others, setOthers] = useState<OtherPlayer[]>([]);
  const [presenters, setPresenters] = useState<Presenter[]>([]);
  const onRoomSignalRef = useRef(opts.onRoomSignal);
  onRoomSignalRef.current = opts.onRoomSignal;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const myKey = useRef<string>("");
  const [myKeyState, setMyKeyState] = useState(""); // 같은 자리를 동시에 고른 경우 누가 양보할지 정하는 데 쓴다
  const stateRef = useRef<PresenceState | null>(null); // 내 최신 상태
  const readyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef(0);
  const clampRef = useRef(opts.clamp);
  const initialRef = useRef(opts.initial);
  // 다른 사람마다 "마지막으로 변화(이동·색·살아 있음 신호)를 본 시각"을 내 시계로 기록한다 (남의 시계는 믿지 않는다)
  const seenRef = useRef(new Map<string, { sig: string; at: number }>());
  const allOthersRef = useRef<OtherPlayer[]>([]);
  const visibleRef = useRef<OtherPlayer[]>([]); // 지금 화면에 넘겨 준 목록 (모양이 안 바뀌면 같은 목록을 유지한다)
  const allPresentersRef = useRef<Presenter[]>([]); // 접속 상태에 전술판을 싣고 있는 사람들 (오래 안 보인 사람은 publish에서 거른다)
  const visiblePresentersRef = useRef<Presenter[]>([]);
  const tacVRef = useRef(0); // 내가 전술판을 바꿀 때마다 1씩 증가 (재접속·설명 재시작에도 줄어들지 않게 상태와 따로 둔다)
  const seenSayRef = useRef(new Map<string, number>()); // 사람별로 이미 본 마지막 메시지 번호
  const lastSayAt = useRef(0);
  const onChatRef = useRef(opts.onChat);
  onChatRef.current = opts.onChat;

  // 너무 자주 보내지 않게 모아서 보낸다(마지막 상태는 반드시 전송)
  const flush = useCallback(() => {
    const ch = channelRef.current;
    const state = stateRef.current;
    if (!ch || !state || !readyRef.current) return;
    const wait = (state.tac ? TAC_MIN_GAP_MS : 100) - (Date.now() - lastSent.current);
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
    setMyKeyState(myKey.current);
    const seen = seenRef.current;
    const seenSay = seenSayRef.current;

    // 신호가 끊긴 지 오래된 사람은 빼고 화면용 목록을 만든다
    const publish = () => {
      const now = Date.now();
      const visible = allOthersRef.current.filter(o => now - (seen.get(o.key)?.at ?? now) < STALE_MS);
      // "살아 있어요" 신호처럼 화면 모양이 안 바뀌는 변화는 React에 알리지 않는다 (30명이 다시 계산되는 것을 막는다)
      const merged = mergeOthers(visibleRef.current, visible);
      if (merged !== visibleRef.current) {
        visibleRef.current = merged;
        setOthers(merged);
      }
      // 설명 중인 사람 목록: 같은 사람·같은 판(v)이면 이전 객체를 그대로 써서 화면이 다시 그려지지 않게 한다
      const livePresenters = allPresentersRef.current.filter(p => now - (seen.get(p.key)?.at ?? now) < STALE_MS);
      const prevP = visiblePresentersRef.current;
      const sameP = livePresenters.length === prevP.length && livePresenters.every((p, i) => prevP[i].key === p.key && prevP[i].v === p.v && prevP[i].name === p.name);
      if (!sameP) {
        const prevByKey = new Map(prevP.map(p => [p.key, p]));
        const nextP = livePresenters.map(p => {
          const old = prevByKey.get(p.key);
          return old && old.v === p.v && old.name === p.name ? old : p;
        });
        visiblePresentersRef.current = nextP;
        setPresenters(nextP);
      }
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

    // ── 접속과 재접속 ──
    // 탭이 오래 가려지거나(앱을 뒤로 보냄) 네트워크가 끊기면 서버가 채널을 닫는데, 라이브러리는 닫힌 채널을 다시 붙여 주지 않는다.
    // 그대로 두면 화면에는 "접속 중"이 남아 있고 채팅은 조용히 막히므로, 끊김을 감지하면 새 채널로 다시 붙는다.
    const channelName = opts.channelName; // 방마다 다른 채널. 이 훅은 방이 바뀌면 새로 마운트된다(LoungeGate가 key로 보장)
    let retry = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let hiddenAt = 0;
    let connectId = 0; // 오래된 시도의 결과가 새 시도를 덮어쓰지 않게 하는 번호

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return;
      retry += 1;
      setStatus(retry > MAX_RETRIES ? "error" : "connecting");
      const delay = Math.min(15_000, 1_500 * 2 ** (retry - 1)); // 1.5초, 3초, 6초 … 최대 15초
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      const id = ++connectId;
      try {
        // 내 첫 상태는 처음 한 번만 만든다(다시 붙을 때는 끊기기 전 상태를 그대로 이어서 쓴다)
        if (stateRef.current === null) {
          const init = initialRef.current;
          stateRef.current = { name: opts.meName, color: init.color, x: init.x, z: init.z, tx: null, tz: null, seq: 0, seat: null, beat: 0, sayId: 0, says: [], tac: null };
        }
        if (cancelled || id !== connectId) return;

        readyRef.current = false;
        seen.clear(); // 다시 붙은 뒤 받는 상태는 전부 "방금 본 것"으로 취급해서, 끊긴 사이 낡은 기록 때문에 사람들이 가려지지 않게 한다
        const old = channel;
        const ch = supabaseClient.channel(channelName, { config: { presence: { key: myKey.current } } });
        channel = ch;
        channelRef.current = ch;

        // 누가 방을 닫았다고 알리면 서버에 다시 물어 확인한다(알림 자체는 믿지 않는다 — 가짜 알림이어도 서버 확인만 한 번 더 할 뿐)
        ch.on("broadcast", { event: "room-closed" }, () => onRoomSignalRef.current?.());

        let synced = false; // 이 접속에서 첫 동기화를 받았는지
        ch.on("presence", { event: "sync" }, () => {
          const raw = ch.presenceState<PresenceState>();
          const list: OtherPlayer[] = [];
          const presenterList: Presenter[] = [];
          const now = Date.now();
          const baseline = !synced; // 내가 막 들어온 첫 동기화: 이미 있던 사람들의 마지막 메시지는 "예전 것"이다
          synced = true;
          for (const [key, metas] of Object.entries(raw)) {
            if (key === myKey.current) continue;
            const meta = metas[metas.length - 1];
            const clean = sanitize(meta, clampRef.current);
            if (!clean) continue;
            // 이동·색·살아 있음 신호 중 하나라도 달라졌으면 "방금 움직임이 있었다"고 기록
            const sig = `${clean.seq}:${clean.beat}:${clean.color}:${clean.tac?.v ?? 0}`;
            if (seen.get(key)?.sig !== sig) seen.set(key, { sig, at: now });

            // 새 채팅 감지: 상태에 실린 최근 메시지 중 내가 아직 못 본 것만 번호순으로 보여준다 (규칙은 collectNewSays 참고).
            // 다시 접속한 사람은 이전에 본 번호(seenSay)를 기억하고 있어서 같은 메시지가 두 번 뜨지 않는다.
            const { emit, nextSeen } = collectNewSays(seenSay.get(key), baseline, clean.sayId, clean.says);
            seenSay.set(key, nextSeen);
            for (const s of emit) {
              // 받는 쪽에서도 한 번 더 거른다 (수정된 앱이 필터를 건너뛰고 보내도 화면에는 안 나온다)
              if (s.text && !containsProfanity(s.text)) {
                onChatRef.current?.({ id: `${key}:${s.id}`, key, name: clean.name, text: s.text, mine: false, at: now });
              }
            }
            const { tac, ...player } = clean;
            list.push({ ...player, key });
            if (tac) presenterList.push({ key, name: clean.name, v: tac.v, board: tac.board });
          }
          for (const key of [...seen.keys()]) if (!list.some(o => o.key === key)) seen.delete(key);
          // seenSay는 사람이 잠깐 사라졌다 돌아와도 지우지 않는다(다시 접속한 사람의 옛 메시지가 새것으로 보이지 않도록). 접속마다 키가 새로 생기니 크기는 작다.
          allOthersRef.current = list;
          allPresentersRef.current = presenterList.sort((a, b) => (a.key < b.key ? -1 : 1));
          publish();
        });

        ch.subscribe(async s => {
          if (cancelled || ch !== channel) return; // 이미 교체된 낡은 채널의 신호는 무시
          if (s === "SUBSCRIBED") {
            retry = 0;
            readyRef.current = true;
            setStatus("online");
            lastSent.current = Date.now();
            if (stateRef.current) await ch.track(stateRef.current); // 끊기기 전의 내 상태(위치·자리·색)를 그대로 다시 알린다
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
            readyRef.current = false;
            scheduleReconnect();
          }
        });

        if (old) void supabaseClient.removeChannel(old);
      } catch {
        if (!cancelled) scheduleReconnect();
      }
    };

    // 화면이 다시 보이거나 인터넷이 돌아오면: 연결이 끊겼으면 기다리지 않고 바로, 20초 넘게 가려져 있었다면 살아 있어 보여도 한 번 새로 붙는다
    const onWake = () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const hiddenLong = hiddenAt > 0 && Date.now() - hiddenAt > 20_000;
      hiddenAt = 0;
      if (readyRef.current && !hiddenLong) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      retry = 0;
      void connect();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);

    void connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
      clearInterval(pruneTimer);
      clearInterval(beatTimer);
      window.removeEventListener("pagehide", onPageHide);
      seen.clear();
      seenSay.clear();
      allOthersRef.current = [];
      visibleRef.current = [];
      allPresentersRef.current = [];
      visiblePresentersRef.current = [];
      setOthers([]);
      setPresenters([]);
      readyRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      if (channel) void supabaseClient.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  /** 내가 바닥을 탭했을 때: 지금 위치에서 목표 지점으로 걸어간다고 알린다. seat가 있으면 그 벤치 자리에 앉으러 가는 것, 없으면(null) 일어나서 걷는 것 */
  const announceMove = useCallback((from: { x: number; z: number }, to: { x: number; z: number }, seat: number | null = null) => {
    const prev = stateRef.current;
    if (!prev) return;
    stateRef.current = { ...prev, x: from.x, z: from.z, tx: to.x, tz: to.z, seq: prev.seq + 1, seat };
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
    const nextId = prev.sayId + 1;
    // 최근 메시지 3개를 함께 실어 보낸다: 전송이 합쳐지거나 받는 쪽이 한두 번 놓쳐도 빠진 메시지를 채울 수 있다
    stateRef.current = { ...prev, sayId: nextId, says: [...prev.says, { id: nextId, text }].slice(-MAX_SAYS_CARRIED) };
    // 이동 전송처럼 모아서 보내지 않고 바로 보낸다 (가려진 탭에서는 타이머가 늦어져 앞 메시지가 뒤 메시지에 덮이기 쉽다)
    lastSent.current = now;
    if (channelRef.current) void channelRef.current.track(stateRef.current);
    onChatRef.current?.({ id: `me:${nextId}`, key: myKey.current, name: prev.name, text, mine: true, at: now });
    return "ok";
  }, []);

  /**
   * 전술 설명 중인 판을 방 전체에 알린다. null이면 설명을 끝낸 것.
   * 접속 상태에 실어 보내므로 DB에는 저장되지 않고, 나중에 들어온 사람도 접속하면 바로 현재 판을 받는다.
   * 변경이 잦으면 모아서 보낸다(마지막 판은 반드시 전송).
   */
  const setTactic = useCallback((board: BoardSnapshot | null) => {
    const prev = stateRef.current;
    if (!prev) return;
    if (board === null) {
      if (!prev.tac) return;
      stateRef.current = { ...prev, tac: null };
    } else {
      tacVRef.current += 1;
      stateRef.current = { ...prev, tac: { v: tacVRef.current, board: compactBoard(board) } };
    }
    flush();
  }, [flush]);

  /** 방을 닫은 직후, 안에 있는 다른 사람들에게 바로 알린다(최대 1초만 기다림). 알림을 못 받아도 그쪽은 주기적으로 서버를 확인하므로 곧 알게 된다. */
  const notifyRoomClosed = useCallback(async () => {
    const ch = channelRef.current;
    if (!ch || !readyRef.current) return;
    try {
      await Promise.race([ch.send({ type: "broadcast", event: "room-closed", payload: {} }), new Promise(resolve => setTimeout(resolve, 1000))]);
    } catch {
      /* 못 보내도 괜찮다 */
    }
  }, []);

  return { status, others, presenters, myKey: myKeyState, announceMove, announceColor, say, setTactic, notifyRoomClosed };
}
