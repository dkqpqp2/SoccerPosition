import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

// POST /api/team/leave - 팀 나가기
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "팀 정보를 찾을 수 없어요" }, { status: 404 });

  const role = await getUserRole(userId, teamId);

  // 팀장은 나갈 수 없음
  if (role === "owner") {
    return NextResponse.json({ error: "팀장은 팀을 나갈 수 없어요. 팀장 권한을 먼저 이전해주세요." }, { status: 400 });
  }

  // team_users에서 제거 (앱 접근 차단)
  await supabaseAdmin
    .from("team_users")
    .delete()
    .eq("team_id", teamId)
    .eq("user_id", userId);

  // team_members에 left_at 기록
  await supabaseAdmin
    .from("team_members")
    .update({ left_at: new Date().toISOString() })
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .is("left_at", null);

  // 내 소유 팀으로 active_team_id 전환
  const { data: myTeam } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("owner_id", userId)
    .single();

  await supabaseAdmin
    .from("users")
    .update({ active_team_id: myTeam?.id ?? null })
    .eq("id", userId);

  return NextResponse.json({ success: true, redirect_team_id: myTeam?.id ?? null });
}
