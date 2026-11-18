import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createHmac, randomInt } from "crypto";
import { authOptions } from "@/lib/auth";
import { getUserAndTeam, getUserRole } from "@/lib/team";
import { isLoungeEnabled } from "@/lib/lounge";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * 라운지 방 채널 이름: 팀 id에 서버 비밀값(NEXTAUTH_SECRET)을 섞어 계산한다.
 * 팀 id를 알아도 이 이름은 알 수 없어서, 이 API(로그인 + 허용 팀 + 팀원 확인)를 거친 사람만 같은 방에 들어올 수 있다.
 */
function channelFor(teamId: string, secret: string) {
  return "lounge-" + createHmac("sha256", secret).update(`lounge:${teamId}`).digest("hex").slice(0, 32);
}

function devGuest(secret: string) {
  return NextResponse.json({ channel: channelFor("dev-team", secret), me: { memberId: null, name: `손님${randomInt(10, 100)}` } });
}

export async function GET() {
  const isDev = process.env.NODE_ENV === "development";
  const secret = process.env.NEXTAUTH_SECRET ?? "";
  if (!secret) return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // 로컬 개발에서만 로그인 없이 손님으로 입장할 수 있다 (두 탭으로 서로 보이는지 시험용)
    if (isDev) return devGuest(secret);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId || !isLoungeEnabled(teamId)) {
    if (isDev) return devGuest(secret);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 이 팀의 팀원인지 확인 (team_users에 역할이 있어야 함)
  const role = await getUserRole(userId, teamId);
  if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // 방에 보일 이름: 활성 팀원 행의 이름 (나간 팀원 제외, 중복 행이 있어도 안전하게 limit(1))
  const { data: members } = await supabaseAdmin
    .from("team_members")
    .select("id, name")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .is("left_at", null)
    .limit(1);
  const member = members?.[0];

  return NextResponse.json({
    channel: channelFor(teamId, secret),
    me: { memberId: member?.id ?? null, name: (member?.name || session.user.name || "팀원").slice(0, 12) },
  });
}
