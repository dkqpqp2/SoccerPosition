import { createHmac, randomUUID } from "crypto";
import { supabaseAdmin } from "./supabase";

// 방 저장소와 방 상태 규칙만 모은 파일 — 로그인·요청 처리(loungeRoom.ts)와 분리해서, 서버 밖(스크립트)에서도 그대로 실행해 검증할 수 있다.

/** 방이 열려 있는 최대 시간(24시간). 연장은 없고, 필요하면 닫고 새로 연다. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export type LoungeRoom = {
  id: string;
  team_id: string;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  closed_at: string | null;
};

/** 닫히지 않았고 만료 시각 전이면 "열린 방" */
export function isRoomOpen(room: Pick<LoungeRoom, "closed_at" | "expires_at"> | null | undefined, nowMs = Date.now()): boolean {
  return !!room && room.closed_at === null && Date.parse(room.expires_at) > nowMs;
}

/**
 * 방 채널 이름: 팀 id + 방 id에 서버 비밀값(NEXTAUTH_SECRET)을 섞어 계산한다.
 * 방마다 이름이 달라서, 닫힌 방의 채널로는 다시 들어올 수 없다. 이름은 이 API(로그인 + 허용 팀 + 팀원 확인)를 거쳐야만 알 수 있다.
 */
export function channelFor(teamId: string, roomId: string, secret: string) {
  return "lounge-" + createHmac("sha256", secret).update(`lounge:${teamId}:${roomId}`).digest("hex").slice(0, 32);
}

// ── 방 저장소: 운영은 DB(lounge_rooms), 로컬 개발의 손님 모드는 메모리 ──
export interface RoomStore {
  getOpen(): Promise<LoungeRoom | null>;
  /** 이미 열린 방이 있으면 그 방을 그대로 돌려준다(팀당 하나) */
  create(userId: string | null, ttlMs: number): Promise<LoungeRoom>;
  /** 지금 열린 방을 닫는다. 닫은 방이 있으면 true */
  close(userId: string | null): Promise<boolean>;
}

const ROOM_COLUMNS = "id, team_id, created_by, created_at, expires_at, closed_at";

export function dbRoomStore(teamId: string): RoomStore {
  const getOpen = async (): Promise<LoungeRoom | null> => {
    const { data, error } = await supabaseAdmin
      .from("lounge_rooms")
      .select(ROOM_COLUMNS)
      .eq("team_id", teamId)
      .is("closed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return (data?.[0] as LoungeRoom | undefined) ?? null;
  };

  return {
    getOpen,
    async create(userId, ttlMs) {
      const existing = await getOpen();
      if (existing) return existing;
      // 만료됐지만 아직 닫힘 표시가 없는 방을 먼저 닫는다 (팀당 열린 방 1개 제한과 부딪히지 않도록)
      const nowIso = new Date().toISOString();
      await supabaseAdmin.from("lounge_rooms").update({ closed_at: nowIso }).eq("team_id", teamId).is("closed_at", null).lte("expires_at", nowIso);
      const { data, error } = await supabaseAdmin
        .from("lounge_rooms")
        .insert({ team_id: teamId, created_by: userId, expires_at: new Date(Date.now() + ttlMs).toISOString() })
        .select(ROOM_COLUMNS);
      if (error) {
        // 두 관리자가 동시에 열어서 유니크 제한에 걸리면, 먼저 만들어진 방을 돌려준다
        if (error.code === "23505") {
          const winner = await getOpen();
          if (winner) return winner;
        }
        throw error;
      }
      return data![0] as LoungeRoom;
    },
    async close(userId) {
      const { data, error } = await supabaseAdmin
        .from("lounge_rooms")
        .update({ closed_at: new Date().toISOString(), closed_by: userId })
        .eq("team_id", teamId)
        .is("closed_at", null)
        .select("id");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  };
}

// 로컬 개발(로그인 없는 손님 모드) 전용 메모리 방 — 서버가 다시 시작되면 사라진다. HMR로 모듈이 다시 불려도 유지되게 globalThis에 둔다.
const g = globalThis as typeof globalThis & { __devLoungeRoom?: LoungeRoom | null };

export function devRoomStore(): RoomStore {
  const getOpen = async () => (isRoomOpen(g.__devLoungeRoom) ? g.__devLoungeRoom! : null);
  return {
    getOpen,
    async create(_userId, ttlMs) {
      const existing = await getOpen();
      if (existing) return existing;
      const now = Date.now();
      const room: LoungeRoom = {
        id: randomUUID(),
        team_id: "dev-team",
        created_by: null,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(now + ttlMs).toISOString(),
        closed_at: null,
      };
      g.__devLoungeRoom = room;
      return room;
    },
    async close() {
      if (!isRoomOpen(g.__devLoungeRoom)) return false;
      g.__devLoungeRoom!.closed_at = new Date().toISOString();
      return true;
    },
  };
}
