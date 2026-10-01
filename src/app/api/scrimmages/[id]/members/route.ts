import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManageScrimmage } from "@/lib/team";

// PATCH - 팀원 한 명을 스쿼드에 배정 (squad_id가 null이면 배정 해제)
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

  // 소속 팀 검증
  const { data: scrimmage } = await supabaseAdmin.from("scrimmages").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!scrimmage) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  // member_id가 실제 이 팀 소속인지 검증 (다른 팀 member_id가 섞여 들어오는 것 방지)
  const { data: member } = await supabaseAdmin.from("team_members").select("id").eq("id", member_id).eq("team_id", teamId).single();
  if (!member) return NextResponse.json({ error: "팀원을 찾을 수 없어요" }, { status: 404 });

  if (!squad_id) {
    const { error } = await supabaseAdmin
      .from("scrimmage_squad_members")
      .delete()
      .eq("scrimmage_id", id)
      .eq("member_id", member_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // squad_id가 실제 이 내전 소속인지 검증
  const { data: squad } = await supabaseAdmin.from("scrimmage_squads").select("id").eq("id", squad_id).eq("scrimmage_id", id).single();
  if (!squad) return NextResponse.json({ error: "스쿼드를 찾을 수 없어요" }, { status: 404 });

  const { error } = await supabaseAdmin
    .from("scrimmage_squad_members")
    .upsert(
      { scrimmage_id: id, squad_id, member_id },
      { onConflict: "scrimmage_id,member_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
