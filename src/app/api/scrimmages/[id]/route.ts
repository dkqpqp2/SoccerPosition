import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, isOwner } from "@/lib/team";

// TODO: 내전 기능 테스트 중 — 지금은 owner에게만 공개. 정식 오픈 시 이 체크 제거
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  const [{ data: scrimmage }, { data: squads }, { data: squadMembers }, { data: roster }] = await Promise.all([
    supabaseAdmin.from("scrimmages").select("*").eq("id", id).eq("team_id", teamId).single(),
    supabaseAdmin.from("scrimmage_squads").select("*").eq("scrimmage_id", id).order("sort_order", { ascending: true }),
    supabaseAdmin.from("scrimmage_squad_members").select("squad_id, member_id").eq("scrimmage_id", id),
    supabaseAdmin
      .from("team_members")
      .select("id, user_id, name, position_1st, position_2nd, jersey_number, is_mercenary, is_cafe_mercenary, referrer")
      .eq("team_id", teamId)
      .is("left_at", null)
      .order("name", { ascending: true }),
  ]);

  if (!scrimmage) return NextResponse.json({ error: "내전을 찾을 수 없어요" }, { status: 404 });

  return NextResponse.json({
    scrimmage,
    squads: squads ?? [],
    squad_members: squadMembers ?? [],
    roster: roster ?? [],
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!isOwner(role)) return NextResponse.json({ error: "관리자만 삭제할 수 있어요" }, { status: 403 });

  const { error } = await supabaseAdmin.from("scrimmages").delete().eq("id", id).eq("team_id", teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
