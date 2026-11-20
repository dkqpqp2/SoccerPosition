import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomInt } from "crypto";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { canManage, getUserAndTeam, getUserRole } from "@/lib/team";
import { isLoungeEnabled } from "@/lib/lounge";
import { channelFor, dbRoomStore, devRoomStore, type LoungeRoom, type RoomStore } from "@/lib/loungeRoomStore";

// 방 저장소와 방 상태 규칙은 loungeRoomStore.ts에 있다 (서버 밖에서도 검증할 수 있게 분리)
export { ROOM_TTL_MS, isRoomOpen, channelFor, type LoungeRoom, type RoomStore } from "@/lib/loungeRoomStore";

// ── 요청한 사람이 누구이고 무엇을 할 수 있는지 ──
export type LoungeContext = {
  kind: "dev" | "team";
  userId: string | null;
  teamId: string;
  manager: boolean; // 방을 열고 닫을 수 있는 관리자급인지
  memberId: string | null;
  meName: string;
  store: RoomStore;
};

/**
 * 로그인 + 허용 팀 + 팀원 확인 후 요청자의 권한을 돌려준다. 통과하지 못하면 바로 돌려줄 응답(error)을 준다.
 * 로컬 개발(next dev)에서만 로그인 없이 손님으로 들어올 수 있다.
 */
export async function resolveLoungeContext(): Promise<{ ctx: LoungeContext } | { error: NextResponse }> {
  const isDev = process.env.NODE_ENV === "development";
  const devGuest = (): { ctx: LoungeContext } => ({
    ctx: { kind: "dev", userId: null, teamId: "dev-team", manager: true, memberId: null, meName: `손님${randomInt(10, 100)}`, store: devRoomStore() },
  });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    if (isDev) return devGuest();
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId || !isLoungeEnabled(teamId)) {
    if (isDev) return devGuest();
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }

  // 이 팀의 팀원인지 확인 (team_users에 역할이 있어야 함)
  const role = await getUserRole(userId, teamId);
  if (!role) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  // 방에 보일 이름: 활성 팀원 행의 이름 (나간 팀원 제외, 중복 행이 있어도 안전하게 limit(1))
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .is("left_at", null)
    .limit(1);
  const member = members?.[0];

  return {
    ctx: {
      kind: "team",
      userId,
      teamId,
      manager: canManage(role),
      memberId: member?.id ?? null,
      meName: ((member?.name as string | undefined) || session.user.name || "팀원").slice(0, 12),
      store: dbRoomStore(teamId),
    },
  };
}

/** 화면이 방 상태를 그리는 데 필요한 응답: 열린 방(없으면 null), 채널 이름, 내 정보, 서버 시각(남은 시간 계산용) */
export async function sessionResponse(ctx: LoungeContext, room: LoungeRoom | null, secret: string) {
  let createdByName: string | null = null;
  if (room?.created_by && ctx.kind === "team") {
    const { data } = await supabaseAdmin
      .from("team_members")
      .select("name")
      .eq("team_id", ctx.teamId)
      .eq("user_id", room.created_by)
      .is("left_at", null)
      .limit(1);
    createdByName = (data?.[0]?.name as string | undefined) ?? null;
  }
  return NextResponse.json({
    serverNow: new Date().toISOString(),
    canManage: ctx.manager,
    me: { memberId: ctx.memberId, name: ctx.meName },
    room: room ? { id: room.id, expiresAt: room.expires_at, createdByName } : null,
    channel: room ? channelFor(ctx.teamId, room.id, secret) : null,
  });
}
