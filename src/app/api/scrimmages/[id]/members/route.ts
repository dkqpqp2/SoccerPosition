import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

// PATCH - 팀원 한 명을 스쿼드에 배정 (squad_id가 null이면 배정 해제)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) return NextResponse.json({ error: "관리자만 팀을 나눌 수 있어요" }, { status: 403 });

  const { member_id, squad_id } = await req.json();
  if (!member_id) return NextResponse.json({ error: "member_id 필요" }, { status: 400 });

  // 소속 팀 검증
  const { data: scrimmage } = await supabaseAdmin.from("scrimmages").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!scrimmage) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  if (!squad_id) {
    const { error } = await supabaseAdmin
      .from("scrimmage_squad_members")
      .delete()
      .eq("scrimmage_id", id)
      .eq("member_id", member_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await supabaseAdmin
    .from("scrimmage_squad_members")
    .upsert(
      { scrimmage_id: id, squad_id, member_id },
      { onConflict: "scrimmage_id,member_id" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
