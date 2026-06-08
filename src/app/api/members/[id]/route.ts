import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam } from "@/lib/team";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, position_1st, position_2nd, is_mercenary, is_cafe_mercenary, referrer } = await req.json();

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .update({ name, position_1st, position_2nd, is_mercenary: !!is_mercenary, is_cafe_mercenary: !!is_cafe_mercenary, referrer: is_mercenary && !is_cafe_mercenary ? (referrer || null) : null })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { teamId } = await getUserAndTeam(session.user.id);
  const { id } = await params;

  // 삭제할 팀원 정보 조회 (계정 있는 멤버면 team_users도 제거)
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  // 소프트 삭제: left_at 기록 (납부 기록 보존을 위해 행 유지)
  const { error } = await supabaseAdmin
    .from("team_members")
    .update({ left_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 계정 있는 멤버면 team_users에서도 제거 (앱 접근 차단)
  if (member?.user_id && teamId) {
    await supabaseAdmin
      .from("team_users")
      .delete()
      .eq("team_id", teamId)
      .eq("user_id", member.user_id);
  }

  return NextResponse.json({ success: true });
}
