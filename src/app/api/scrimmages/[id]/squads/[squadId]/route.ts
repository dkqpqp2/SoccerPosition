import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; squadId: string }> }) {
  const { id, squadId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  const owner = isOwner(role);

  const { data: scrimmage } = await supabaseAdmin.from("scrimmages").select("id").eq("id", id).eq("team_id", teamId).single();
  if (!scrimmage) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  const { data: squad } = await supabaseAdmin.from("scrimmage_squads").select("*").eq("id", squadId).eq("scrimmage_id", id).single();
  if (!squad) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  // owner가 아니면 이 스쿼드의 주장인지 확인 (포메이션·포지션만 수정 가능)
  let isCaptain = false;
  if (!owner && squad.captain_member_id) {
    const { data: myMember } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .eq("id", squad.captain_member_id)
      .limit(1);
    isCaptain = (myMember?.length ?? 0) > 0;
  }

  if (!owner && !isCaptain) return NextResponse.json({ error: "관리자 또는 이 팀의 주장만 수정할 수 있어요" }, { status: 403 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  // 팀 이름·색·주장 지정은 owner만 변경 가능
  if (owner) {
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.color === "string" || body.color === null) update.color = body.color;
    if (typeof body.captain_member_id === "string" || body.captain_member_id === null) update.captain_member_id = body.captain_member_id;
  }
  // 포메이션·포지션 배정은 owner 또는 이 스쿼드의 주장 모두 변경 가능
  if (typeof body.formation_name === "string" || body.formation_name === null) update.formation_name = body.formation_name;
  if (Array.isArray(body.formation_slots) || body.formation_slots === null) update.formation_slots = body.formation_slots;
  if (body.assigned && typeof body.assigned === "object") update.assigned = body.assigned;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "수정할 내용이 없어요" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("scrimmage_squads")
    .update(update)
    .eq("id", squadId)
    .eq("scrimmage_id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
