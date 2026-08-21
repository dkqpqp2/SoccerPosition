import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getUserAndTeam, getUserRole, canManage } from "@/lib/team";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  const { id } = await params;
  const { name, position_1st, position_2nd, jersey_number, is_mercenary, is_cafe_mercenary, referrer } = await req.json();

  if (jersey_number !== undefined && role !== "owner") {
    return NextResponse.json({ error: "등번호는 팀장만 수정할 수 있어요" }, { status: 403 });
  }

  if (jersey_number !== undefined && jersey_number !== null) {
    const { data: conflict } = await supabaseAdmin
      .from("team_members")
      .select("id")
      .eq("team_id", teamId)
      .eq("jersey_number", jersey_number)
      .neq("id", id)
      .is("left_at", null)
      .maybeSingle();

    if (conflict) {
      return NextResponse.json({ error: `이미 팀 안에 등번호 ${jersey_number}번을 쓰는 선수가 있어요.` }, { status: 409 });
    }
  }

  const { data, error } = await supabaseAdmin
    .from("team_members")
    .update({
      name, position_1st, position_2nd,
      ...(jersey_number !== undefined && { jersey_number: jersey_number ?? null }),
      is_mercenary: !!is_mercenary, is_cafe_mercenary: !!is_cafe_mercenary,
      referrer: is_mercenary && !is_cafe_mercenary ? (referrer || null) : null,
    })
    .eq("id", id)
    .eq("team_id", teamId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 계정이 연결된 팀원이면 users.jersey_number도 같이 맞춰서, 본인이 마이페이지에서 다른 값을 저장할 때 덮어써지지 않게 함
  if (jersey_number !== undefined && data?.user_id) {
    await supabaseAdmin.from("users").update({ jersey_number: jersey_number ?? null }).eq("id", data.user_id);
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { userId, teamId } = await getUserAndTeam(session.user.id);
  if (!userId || !teamId) return NextResponse.json({ error: "No team" }, { status: 404 });

  const role = await getUserRole(userId, teamId);
  if (!canManage(role)) {
    return NextResponse.json({ error: "권한이 없어요" }, { status: 403 });
  }

  const { id } = await params;

  // 삭제할 팀원 정보 조회 (계정 있는 멤버면 team_users도 제거)
  const { data: member } = await supabaseAdmin
    .from("team_members")
    .select("id, user_id")
    .eq("id", id)
    .eq("team_id", teamId)
    .maybeSingle();

  if (!member) return NextResponse.json({ error: "팀원을 찾을 수 없어요" }, { status: 404 });

  // 소프트 삭제: left_at 기록 (납부 기록 보존을 위해 행 유지), 등번호는 반납해서 재사용 가능하게
  const { error } = await supabaseAdmin
    .from("team_members")
    .update({ left_at: new Date().toISOString(), jersey_number: null })
    .eq("id", id)
    .eq("team_id", teamId);

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
