import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole } from "@/lib/team";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  // 강퇴/탈퇴 감지: 현재 팀의 team_users에 없으면 내 팀으로 자동 전환
  const { data: membership } = await supabaseAdmin
    .from("team_users")
    .select("id")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .maybeSingle();

  if (!membership) {
    const { data: myTeam } = await supabaseAdmin
      .from("teams")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();

    const fallbackTeamId = myTeam?.id ?? null;
    await supabaseAdmin
      .from("users")
      .update({ active_team_id: fallbackTeamId })
      .eq("id", userId);

    // kicked 응답: 클라이언트에서 팀 전환 처리
    return NextResponse.json({ error: "kicked", redirect_team_id: fallbackTeamId }, { status: 403 });
  }

  const [{ data: team }, { data: members }, myRole] = await Promise.all([
    supabaseAdmin.from("teams").select("id, name, color, invite_code, owner_id, created_at").eq("id", teamId).single(),
    supabaseAdmin.from("team_users").select("role, joined_at, user_id, users(id, name, email, image)").eq("team_id", teamId).order("joined_at", { ascending: true }),
    getUserRole(userId, teamId),
  ]);

  return NextResponse.json({
    ...team,
    my_role: myRole,
    is_owner: myRole === "owner",
    can_manage: myRole === "owner" || myRole === "manager" || myRole === "coach" || myRole === "president",
    members: members ?? [],
  });
}
