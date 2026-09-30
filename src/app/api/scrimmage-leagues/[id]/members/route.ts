import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageScrimmage } from "@/lib/team";

// PATCH - 팀원 한 명을 리그의 고정 팀에 배정 (squad_id가 null이면 배정 해제). 한 리그당 한 팀만 가능
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManageScrimmage(role)) return NextResponse.json({ error: "관리자·매니저·회장만 팀을 나눌 수 있어요" }, { status: 403 });

  const { member_id, squad_id } = await req.json();
  if (!member_id) return NextResponse.json({ error: "member_id 필요" }, { status: 400 });

  const { data: league } = await supabaseAdmin.from("scrimmage_leagues").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!league) return NextResponse.json({ error: "리그를 찾을 수 없어요" }, { status: 404 });

  if (!squad_id) {
    const { error } = await supabaseAdmin
      .from("scrimmage_league_squad_members")
      .delete()
      .eq("league_id", id)
      .eq("member_id", member_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseAdmin
    .from("scrimmage_league_squad_members")
    .upsert(
      { league_id: id, squad_id, member_id },
      { onConflict: "league_id,member_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
